import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateJSON } from "@/lib/gemini";
import { evaluateRound2Prompt } from "@/lib/prompts/listening";

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
    const { sessionId, notes } = body as { sessionId: string; notes: string };

    if (!sessionId || !notes || typeof notes !== "string") {
      return NextResponse.json({ error: "Missing sessionId or notes" }, { status: 400 });
    }

    if (notes.trim().length < 10) {
      return NextResponse.json({ error: "Notes too short" }, { status: 400 });
    }

    if (notes.length > 5000) {
      return NextResponse.json({ error: "Notes too long" }, { status: 400 });
    }

    const session = await prisma.listeningSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.round1Response) {
      return NextResponse.json({ error: "Complete Round 1 first" }, { status: 400 });
    }

    if (session.round2Response) {
      return NextResponse.json({ error: "Round 2 already submitted" }, { status: 409 });
    }

    const prompt = evaluateRound2Prompt(
      session.passageText,
      session.passageTitle,
      session.informationType || session.passageTopic,
      notes.trim()
    );

    const feedback = await generateJSON(prompt, { temperature: 0.3 });
    const round2Score = Math.min(15, Math.max(0, Number(feedback.score) || 0));
    const round1Score = session.round1Score ?? 0;
    const overallScore = Math.round(((round1Score + round2Score) / 25) * 100);

    await prisma.listeningSession.update({
      where: { id: sessionId },
      data: {
        round2Response: notes.trim(),
        round2Feedback: { ...feedback, score: round2Score },
        round2Score,
        overallScore,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      feedback: { ...feedback, score: round2Score },
      overallScore,
      round1Score,
      round2Score,
    });
  } catch (err) {
    console.error("Listening round2 error:", err);
    return NextResponse.json({ error: "Failed to evaluate notes" }, { status: 500 });
  }
}
