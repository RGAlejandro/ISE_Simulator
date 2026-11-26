import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { DEFAULT_ROUND, EXAM_LEVEL_VALUES, isRoundSize, sanitizeItems, type SourceLang } from "@/lib/translation";
import { pickStructures, translationGeneratePrompt } from "@/lib/prompts/translation";
import type { ExamLevel } from "@/types";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { level?: string; locale?: string; count?: unknown };
    const level = body.level as ExamLevel;
    if (!EXAM_LEVEL_VALUES.includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    const count = isRoundSize(body.count) ? body.count : DEFAULT_ROUND;
    // A round may come back a little short; below this it isn't worth starting.
    const minItems = Math.ceil(count * 0.75);

    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeTranslation) {
      return NextResponse.json({ error: "limit", code: "DAILY_LIMIT" }, { status: 429 });
    }

    // Source sentences follow the UI language; English speakers get Spanish (the app's main audience).
    const source: SourceLang = body.locale === "fr" ? "fr" : "es";
    const prompt = translationGeneratePrompt(level, source, pickStructures(level, count), body.locale ?? "es");
    const opts = { temperature: 0.8, maxTokens: 300 + count * 170 };

    let items = sanitizeItems(await generateJSON(prompt, opts).catch(() => null), count);
    if (items.length < minItems) {
      items = sanitizeItems(await generateJSON(prompt, { ...opts, prefer: "gemini" }).catch(() => null), count);
    }
    if (items.length < minItems) {
      return NextResponse.json({ error: "Failed to generate sentences" }, { status: 503 });
    }

    const session = await prisma.translationSession.create({
      data: { userId: user.id, level, sourceLang: source, items: JSON.parse(JSON.stringify(items)) },
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error("Translation generate error:", err);
    return NextResponse.json({ error: "Failed to generate sentences" }, { status: 500 });
  }
}
