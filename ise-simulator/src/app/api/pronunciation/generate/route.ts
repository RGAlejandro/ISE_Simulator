import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { getAccent, DIFFICULTY_META, type PronDifficulty } from "@/lib/pronunciation";
import { getPronunciationTextPrompt } from "@/lib/prompts/pronunciation";

const VALID_DIFFICULTY: PronDifficulty[] = ["easy", "normal", "advanced"];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { accent: accentId, difficulty, topic } = body as {
      accent?: string; difficulty?: string; topic?: string | null;
    };

    const accent = getAccent(accentId);
    const diff: PronDifficulty = VALID_DIFFICULTY.includes(difficulty as PronDifficulty)
      ? (difficulty as PronDifficulty)
      : "normal";

    const data = await generateJSON(getPronunciationTextPrompt(accent, diff, topic), {
      temperature: 0.8,
    });

    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text || text.length < 20) {
      return NextResponse.json({ error: "Couldn't generate a passage. Try again." }, { status: 503 });
    }

    return NextResponse.json({ text, accent: accent.id, difficulty: diff, label: DIFFICULTY_META[diff].label });
  } catch (err) {
    console.error("Pronunciation generate error:", err);
    return NextResponse.json({ error: "Failed to generate passage" }, { status: 500 });
  }
}
