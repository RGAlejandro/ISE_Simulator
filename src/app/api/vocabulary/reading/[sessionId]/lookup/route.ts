import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { generateReadingLookupPrompt } from "@/lib/prompts/reading";
import { containsPhrase, normalizeWord, splitSentences, toLookupData } from "@/lib/reading";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { ReadingContent } from "@/types";

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
/** Once a session has this many lookups, new words are no longer sent to the AI. */
const MAX_AI_LOOKUPS_PER_SESSION = 80;

/**
 * Gloss a word the learner tapped, in the context of its sentence. Key words
 * are answered from the stored text; other words reuse any gloss already made
 * for the same word in the same sentence of this text, and only then hit the AI.
 */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { sessionId } = await params;
    const session = await prisma.readingSession.findUnique({
      where: { id: sessionId },
      include: { reading: true },
    });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { word, paragraph, sentence } = body as { word?: string; paragraph?: number; sentence?: number };
    if (typeof word !== "string" || !word.trim() || word.length > 60) {
      return NextResponse.json({ error: "Invalid word" }, { status: 400 });
    }
    if (!Number.isInteger(paragraph) || !Number.isInteger(sentence)) {
      return NextResponse.json({ error: "Invalid position" }, { status: 400 });
    }

    const content = session.reading.content as unknown as ReadingContent;
    const paragraphText = content.paragraphs[paragraph as number];
    const sentenceText = paragraphText ? splitSentences(paragraphText)[sentence as number] : undefined;
    // The sentence is re-derived server-side; the word must really be in it.
    if (!sentenceText || !containsPhrase(sentenceText, word)) {
      return NextResponse.json({ error: "Word not found in the text" }, { status: 400 });
    }

    const key = {
      sessionId,
      word: normalizeWord(word),
      paragraph: paragraph as number,
      sentence: sentence as number,
    };

    const existing = await prisma.readingLookup.findUnique({
      where: { sessionId_word_paragraph_sentence: key },
    });
    if (existing) return NextResponse.json({ lookup: toLookupData(existing) });

    let gloss: { lemma: string; partOfSpeech: string | null; translation: string; definition: string; level: string | null } | null = null;

    const target = content.targetWords.find((t) => normalizeWord(t.word) === key.word);
    if (target) {
      gloss = {
        lemma: target.lemma,
        partOfSpeech: target.partOfSpeech,
        translation: target.translation,
        definition: target.definition,
        level: session.reading.level,
      };
    }

    if (!gloss) {
      const cached = await prisma.readingLookup.findFirst({
        where: {
          word: key.word,
          paragraph: key.paragraph,
          sentence: key.sentence,
          session: { readingId: session.readingId },
        },
      });
      if (cached) {
        gloss = {
          lemma: cached.lemma,
          partOfSpeech: cached.partOfSpeech,
          translation: cached.translation,
          definition: cached.definition,
          level: cached.level,
        };
      }
    }

    if (!gloss) {
      const count = await prisma.readingLookup.count({ where: { sessionId } });
      if (count >= MAX_AI_LOOKUPS_PER_SESSION) {
        return NextResponse.json({ error: "Lookup limit reached for this text." }, { status: 429 });
      }

      const data = await generateJSON(
        generateReadingLookupPrompt({
          word: word.trim(),
          sentence: sentenceText,
          locale: session.reading.locale,
          level: session.reading.level as CefrBand,
        }),
        { temperature: 0.2 },
      );
      const translation = typeof data?.translation === "string" ? data.translation.trim().slice(0, 80) : "";
      const definition = typeof data?.definition === "string" ? data.definition.trim().slice(0, 200) : "";
      if (!translation || !definition) {
        return NextResponse.json({ error: "Couldn't look up this word. Try again." }, { status: 503 });
      }
      gloss = {
        lemma: typeof data?.lemma === "string" && data.lemma.trim() ? data.lemma.trim().slice(0, 60) : word.trim(),
        partOfSpeech: typeof data?.partOfSpeech === "string" ? data.partOfSpeech.trim().slice(0, 30) : null,
        translation,
        definition,
        level: VALID_LEVELS.includes(data?.level) ? data.level : null,
      };
    }

    const lookup = await prisma.readingLookup.upsert({
      where: { sessionId_word_paragraph_sentence: key },
      create: { ...key, ...gloss },
      update: {},
    });
    return NextResponse.json({ lookup: toLookupData(lookup) });
  } catch (err) {
    console.error("Reading lookup error:", err);
    return NextResponse.json({ error: "Failed to look up word" }, { status: 500 });
  }
}
