import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/ai-provider";
import { exampleTranslationPrompt, translationLocale } from "@/lib/prompts/vocabulary";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A flashcard example sentence in the learner's language (cached by the browser). */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const example = str(body.example, 400);
    const english = str(body.english, 80);
    if (example.length < 3 || !english) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const prompt = exampleTranslationPrompt({
      example,
      english,
      translation: str(body.translation, 120),
      locale: translationLocale(str(body.locale, 5)),
    });
    const data = await generateJSON(prompt, { temperature: 0.2, maxTokens: 300 });
    const translation = str(data?.translation, 600);
    if (!translation) return NextResponse.json({ error: "Translation failed" }, { status: 503 });
    return NextResponse.json({ translation });
  } catch (err) {
    console.error("Example translation error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
