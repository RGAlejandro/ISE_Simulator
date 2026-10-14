import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { generateJSON } from "@/lib/ai-provider";
import { modelAnswersPrompt } from "@/lib/prompts/listening";

export const runtime = "nodejs";

interface ModelAnswers {
  task1ModelAnswer: string;
  task2KeyPoints: string[];
}

// Cache per passage so repeated PDF downloads don't re-hit the model.
const cache = new Map<string, ModelAnswers>();

export async function POST(req: Request) {
  // Admin-only: this is the answer key.
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const passageText = typeof body?.passageText === "string" ? body.passageText : "";
  const passageTitle = typeof body?.passageTitle === "string" ? body.passageTitle : "";
  const informationType = typeof body?.informationType === "string" ? body.informationType : "";

  if (!passageText.trim()) {
    return NextResponse.json({ error: "Missing passage" }, { status: 400 });
  }

  const cacheKey = passageText.slice(0, 200) + passageText.length;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const result = await generateJSON(
      modelAnswersPrompt(passageText, passageTitle, informationType),
      { temperature: 0.3 }
    );
    const answers: ModelAnswers = {
      task1ModelAnswer: typeof result?.task1ModelAnswer === "string" ? result.task1ModelAnswer : "",
      task2KeyPoints: Array.isArray(result?.task2KeyPoints)
        ? result.task2KeyPoints.filter((p: unknown): p is string => typeof p === "string")
        : [],
    };

    if (cache.size > 50) cache.clear();
    cache.set(cacheKey, answers);

    return NextResponse.json(answers);
  } catch (err) {
    console.error("[listening/model-answers]", err);
    return NextResponse.json({ error: "Failed to generate model answers" }, { status: 502 });
  }
}
