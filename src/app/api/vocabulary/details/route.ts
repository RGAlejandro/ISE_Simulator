import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { generateWordDetailsPrompt, type CefrBand } from "@/lib/prompts/vocabulary";

const VALID_LEVELS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { english, level } = body as { english?: string; level?: CefrBand };

    if (!english || typeof english !== "string" || english.length > 80) {
      return NextResponse.json({ error: "Invalid word" }, { status: 400 });
    }
    const safeLevel: CefrBand = level && VALID_LEVELS.includes(level) ? level : "B1";

    const prompt = generateWordDetailsPrompt(english.trim(), safeLevel);
    const data = await generateJSON(prompt, { temperature: 0.4 });

    if (typeof data?.ipa !== "string" || !Array.isArray(data?.examples)) {
      return NextResponse.json({ error: "Generation failed" }, { status: 503 });
    }

    return NextResponse.json({
      details: {
        ipa: data.ipa,
        synonyms: Array.isArray(data.synonyms) ? data.synonyms.slice(0, 6) : [],
        antonyms: Array.isArray(data.antonyms) ? data.antonyms.slice(0, 4) : [],
        examples: data.examples.slice(0, 3),
        collocations: Array.isArray(data.collocations) ? data.collocations.slice(0, 5) : [],
        register: typeof data.register === "string" ? data.register : "neutral",
      },
    });
  } catch (err) {
    console.error("Word details error:", err);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}
