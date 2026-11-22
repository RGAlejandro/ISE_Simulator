import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import {
  MAX_ANSWER, matchesReference, roundScore, sanitizeResult,
  type SourceLang, type TranslationItem, type TranslationResult,
} from "@/lib/translation";
import { translationCheckPrompt } from "@/lib/prompts/translation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { itemId?: string; answer?: string; locale?: string };
    const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, MAX_ANSWER) : "";
    if (!body.itemId || answer.length < 2) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const session = await prisma.translationSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const items = session.items as unknown as TranslationItem[];
    const item = items.find((i) => i.id === body.itemId);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const answers = (session.answers ?? {}) as unknown as Record<string, TranslationResult>;
    // Each sentence is checked once; a repeat request returns the stored result.
    if (answers[item.id]) {
      return NextResponse.json({ result: answers[item.id], done: !!session.completedAt, score: session.score });
    }

    let result: TranslationResult;
    if (matchesReference(answer, item.reference)) {
      result = { answer, verdict: "correct", corrected: answer, note: "", natural: "" };
    } else {
      const prompt = translationCheckPrompt({
        level: session.level,
        source: session.sourceLang as SourceLang,
        item,
        answer,
        locale: body.locale ?? "es",
      });
      result = sanitizeResult(await generateJSON(prompt, { temperature: 0.2 }), answer);
    }

    const next = { ...answers, [item.id]: result };
    const done = items.every((i) => next[i.id]);
    const score = done ? roundScore(Object.values(next), items.length) : null;

    await prisma.translationSession.update({
      where: { id },
      data: {
        answers: JSON.parse(JSON.stringify(next)),
        ...(done ? { score, completedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ result, done, score });
  } catch (err) {
    console.error("Translation check error:", err);
    return NextResponse.json({ error: "Failed to check translation" }, { status: 500 });
  }
}
