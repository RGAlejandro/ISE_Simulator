import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { evaluateRound1Prompt } from "@/lib/prompts/listening";

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
    const { sessionId, response } = body as { sessionId: string; response: string };

    if (!sessionId || !response || typeof response !== "string") {
      return NextResponse.json({ error: "Missing sessionId or response" }, { status: 400 });
    }

    if (response.trim().length < 5) {
      return NextResponse.json({ error: "Response too short" }, { status: 400 });
    }

    if (response.length > 2000) {
      return NextResponse.json({ error: "Response too long" }, { status: 400 });
    }

    const session = await prisma.listeningSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.round1Response) {
      return NextResponse.json({ error: "Round 1 already submitted" }, { status: 409 });
    }

    const prompt = evaluateRound1Prompt(
      session.passageText,
      session.passageTitle,
      session.informationType || session.passageTopic,
      response.trim()
    );

    const feedback = await generateJSON(prompt, { temperature: 0.3 });
    const score = Math.min(10, Math.max(0, Number(feedback.score) || 0));

    await prisma.listeningSession.update({
      where: { id: sessionId },
      data: {
        round1Response: response.trim(),
        round1Feedback: { ...feedback, score },
        round1Score: score,
      },
    });

    return NextResponse.json({ feedback: { ...feedback, score } });
  } catch (err) {
    console.error("Listening round1 error:", err);
    return NextResponse.json({ error: "Failed to evaluate response" }, { status: 500 });
  }
}
