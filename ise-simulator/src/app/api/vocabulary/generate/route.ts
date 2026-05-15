import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { generateAdaptiveVocabularyPrompt } from "@/lib/prompts/vocabulary";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { score, alreadySeen = [] } = body as { score: number; alreadySeen?: string[] };

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    if (!Array.isArray(alreadySeen)) {
      return NextResponse.json({ error: "Invalid alreadySeen" }, { status: 400 });
    }

    const prompt = generateAdaptiveVocabularyPrompt(score, alreadySeen);
    const data = await generateJSON(prompt, { temperature: 0.85 });

    if (!Array.isArray(data?.cards) || data.cards.length === 0) {
      return NextResponse.json({ error: "Failed to generate cards" }, { status: 503 });
    }

    const cards = data.cards.slice(0, 5).filter(
      (c: unknown) =>
        typeof c === "object" && c !== null &&
        typeof (c as Record<string, unknown>).english === "string" &&
        typeof (c as Record<string, unknown>).spanish === "string" &&
        typeof (c as Record<string, unknown>).example === "string"
    );

    if (cards.length === 0) {
      return NextResponse.json({ error: "Generated cards were invalid" }, { status: 503 });
    }

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("Vocabulary generate error:", err);
    return NextResponse.json({ error: "Failed to generate vocabulary" }, { status: 500 });
  }
}
