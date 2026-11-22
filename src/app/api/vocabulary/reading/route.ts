import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { translationLocale, type CefrBand } from "@/lib/prompts/vocabulary";
import { READING_TOPICS, generateReadingPrompt, pickReadingTopic } from "@/lib/prompts/reading";
import { normalizeWord, sanitizeReadingContent } from "@/lib/reading";

const VALID_LEVELS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
/** Saved words woven into a personalised text. */
const MAX_LIST_WORDS = 6;
const MIN_LIST_WORDS = 3;
/** Saved words are user input that ends up in a prompt — only plain words/expressions. */
const LIST_WORD_RE = /^[A-Za-z][A-Za-z '’-]{0,40}$/;
const MIN_TARGET_WORDS = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Start a Reading Explorer session. Generic texts come from a shared pool
 * (any text at this level/language the user hasn't read yet) and are only
 * generated when the pool runs dry; texts woven from a saved list are
 * personal and always generated.
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { level, topic, listId, locale = "es" } = body as {
      level?: string; topic?: string; listId?: string | null; locale?: string;
    };

    if (!level || !VALID_LEVELS.includes(level as CefrBand)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    const cefr = level as CefrBand;
    const requestedTopic = topic && topic !== "random" ? topic : null;
    if (requestedTopic && !READING_TOPICS[cefr].includes(requestedTopic)) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
    }
    const lang = translationLocale(locale);

    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeReading) {
      return NextResponse.json(
        { error: "Daily reading limit reached. Upgrade to Pro for unlimited readings." },
        { status: 429 },
      );
    }

    let listWords: string[] = [];
    if (listId) {
      const list = await prisma.vocabularyList.findUnique({
        where: { id: listId },
        include: { words: { select: { english: true } } },
      });
      if (!list || list.userId !== user.id) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
      listWords = shuffle(list.words.map((w) => w.english.trim()).filter((w) => LIST_WORD_RE.test(w))).slice(0, MAX_LIST_WORDS);
      if (listWords.length < MIN_LIST_WORDS) {
        return NextResponse.json(
          { error: `This list needs at least ${MIN_LIST_WORDS} words to build a text.` },
          { status: 400 },
        );
      }
    }

    let readingId: string | null = null;

    if (listWords.length === 0) {
      const pool = await prisma.readingText.findMany({
        where: {
          ownerId: null,
          level: cefr,
          locale: lang,
          ...(requestedTopic ? { topic: requestedTopic } : {}),
          sessions: { none: { userId: user.id } },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      if (pool.length > 0) readingId = pool[Math.floor(Math.random() * pool.length)].id;
    }

    if (!readingId) {
      const chosenTopic = requestedTopic ?? pickReadingTopic(cefr);
      const prompt = generateReadingPrompt({ level: cefr, topic: chosenTopic, locale: lang, listWords });
      let result = sanitizeReadingContent(await generateJSON(prompt, { temperature: 0.8 }), MIN_TARGET_WORDS);
      if (!result) {
        // One retry — small models occasionally drop fields or misquote key words.
        result = sanitizeReadingContent(await generateJSON(prompt, { temperature: 0.7 }), MIN_TARGET_WORDS);
      }
      if (!result) {
        return NextResponse.json({ error: "Couldn't generate a good text. Please try again." }, { status: 503 });
      }
      if (listWords.length > 0) {
        const fromList = new Set(listWords.map(normalizeWord));
        for (const tw of result.content.targetWords) {
          if (fromList.has(normalizeWord(tw.lemma)) || fromList.has(normalizeWord(tw.word))) tw.fromList = true;
        }
      }

      const reading = await prisma.readingText.create({
        data: {
          ownerId: listWords.length > 0 ? user.id : null,
          level: cefr,
          topic: chosenTopic,
          locale: lang,
          title: result.title,
          content: JSON.parse(JSON.stringify(result.content)),
        },
      });
      readingId = reading.id;
    }

    const session = await prisma.readingSession.upsert({
      where: { userId_readingId: { userId: user.id, readingId } },
      create: { userId: user.id, readingId },
      update: {},
    });
    await incrementUsage(user.id, "reading");

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error("Reading generate error:", err);
    return NextResponse.json({ error: "Failed to start reading" }, { status: 500 });
  }
}
