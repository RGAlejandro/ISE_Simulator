import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/gemini";
import { generateGrammarPrompt } from "@/lib/prompts/grammar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import type { CefrLevel, GrammarExerciseType, GrammarQuestion } from "@/types";

const VALID_CEFR: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const VALID_TYPES: GrammarExerciseType[] = ["gap_fill", "mcq", "error_correction"];

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { cefrLevel, exerciseType } = body as { cefrLevel: CefrLevel; exerciseType: GrammarExerciseType };

    if (!VALID_CEFR.includes(cefrLevel)) {
      return NextResponse.json({ error: "Invalid CEFR level" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(exerciseType)) {
      return NextResponse.json({ error: "Invalid exercise type" }, { status: 400 });
    }

    const prompt = generateGrammarPrompt(cefrLevel, exerciseType);
    const data = await generateJSON(prompt, { temperature: 0.8 });

    if (!Array.isArray(data?.exercises) || data.exercises.length < 10) {
      return NextResponse.json({ error: "Failed to generate exercises" }, { status: 503 });
    }

    const questions: GrammarQuestion[] = data.exercises.slice(0, 10).filter((q: unknown) => {
      if (typeof q !== "object" || q === null) return false;
      const item = q as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.type !== "string") return false;
      if (item.type === "gap_fill") return typeof item.sentence === "string" && typeof item.correctAnswer === "string";
      if (item.type === "mcq") return typeof item.question === "string" && Array.isArray(item.options) && typeof item.correctAnswer === "number";
      if (item.type === "error_correction") return typeof item.sentence === "string" && typeof item.correctAnswer === "string";
      return false;
    });

    if (questions.length < 5) {
      return NextResponse.json({ error: "Generated exercises were invalid" }, { status: 503 });
    }

    const session = await prisma.grammarSession.create({
      data: {
        userId: user.id,
        cefrLevel,
        exerciseType,
        questions: JSON.parse(JSON.stringify(questions)),
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error("Grammar generate error:", err);
    return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}
