import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { getAccent } from "@/lib/pronunciation";
import { getPronunciationFeedbackPrompt } from "@/lib/prompts/pronunciation";

const MAX = 3000;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { accent: accentId, target, transcript, missedWords } = body as {
      accent?: string; target?: string; transcript?: string; missedWords?: string[];
    };

    if (!target || !transcript) {
      return NextResponse.json({ error: "Missing target or transcript" }, { status: 400 });
    }

    const accent = getAccent(accentId);
    const missed = Array.isArray(missedWords) ? missedWords.slice(0, 30).map(String) : [];

    const data = await generateJSON(
      getPronunciationFeedbackPrompt(accent, target.slice(0, MAX), transcript.slice(0, MAX), missed),
      { temperature: 0.4 },
    );

    const tips = Array.isArray(data?.tips)
      ? data.tips.filter((t: unknown) => typeof t === "string").slice(0, 6)
      : [];

    if (tips.length === 0) {
      return NextResponse.json({ error: "Couldn't generate tips. Try again." }, { status: 503 });
    }

    return NextResponse.json({ tips });
  } catch (err) {
    console.error("Pronunciation feedback error:", err);
    return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 });
  }
}
