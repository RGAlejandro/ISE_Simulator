import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist, getCurrentUser, isProUser } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { getSentenceCheckPrompt } from "@/lib/prompts/writing";

const MAX_ITEMS = 3;
const MAX_SENTENCE = 300;

/** "Use it in a sentence": the AI checks whether the learner can actually use their words. */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { items, locale = "es" } = (await req.json()) as {
      items?: { wordId?: string; sentence?: string }[]; locale?: string;
    };
    const clean = (Array.isArray(items) ? items : [])
      .map((it) => ({ wordId: it?.wordId ?? "", sentence: (it?.sentence ?? "").trim().slice(0, MAX_SENTENCE) }))
      .filter((it) => it.wordId && it.sentence.split(/\s+/).length >= 3);
    if (clean.length === 0 || clean.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Write at least one full sentence" }, { status: 400 });
    }

    const words = await prisma.savedWord.findMany({
      where: { id: { in: clean.map((c) => c.wordId) }, userId: user.id },
      select: { id: true, english: true },
    });
    const byId = new Map(words.map((w) => [w.id, w.english]));
    if (clean.some((c) => !byId.has(c.wordId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!(await consumeAiAssist(user.id, isProUser(user)))) {
      return NextResponse.json({ error: "Daily limit for AI helpers reached. Try again tomorrow." }, { status: 429 });
    }

    const out = await generateJSON(
      getSentenceCheckPrompt(clean.map((c) => ({ word: byId.get(c.wordId)!, sentence: c.sentence })), locale),
      { temperature: 0.2, prefer: "gemini" },
    );
    const raw = Array.isArray(out?.results) ? out.results : [];
    const results = clean.map((c, i) => {
      const r = raw[i] ?? {};
      return {
        wordId: c.wordId,
        ok: r.ok === true,
        feedback: typeof r.feedback === "string" ? r.feedback.slice(0, 400) : "",
        improved: typeof r.improved === "string" ? r.improved.slice(0, 400) : "",
      };
    });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Sentence check error:", err);
    return NextResponse.json({ error: "Failed to check sentences" }, { status: 500 });
  }
}
