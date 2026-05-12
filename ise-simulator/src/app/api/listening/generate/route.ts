import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import { generateJSON } from "@/lib/gemini";
import { generateListeningPrompt } from "@/lib/prompts/listening";
import type { ExamLevel } from "@/types";

const VALID_LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];

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
    const { level } = body as { level: ExamLevel };

    if (!level || !VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeListening) {
      return NextResponse.json(
        { error: "Daily listening limit reached. Upgrade to Pro for more sessions." },
        { status: 429 }
      );
    }

    const prompt = generateListeningPrompt(level);
    const passageData = await generateJSON(prompt, { temperature: 0.75 });

    if (!passageData.passageText || !passageData.title) {
      return NextResponse.json({ error: "Failed to generate passage" }, { status: 503 });
    }

    const session = await prisma.listeningSession.create({
      data: {
        userId: user.id,
        level,
        passageText: passageData.passageText,
        passageTitle: passageData.title,
        passageTopic: passageData.topic ?? "",
        informationType: passageData.informationType ?? "",
        status: "IN_PROGRESS",
      },
    });

    await incrementUsage(user.id, "listening");

    return NextResponse.json({
      sessionId: session.id,
      passageTitle: session.passageTitle,
      passageTopic: session.passageTopic,
      informationType: passageData.informationType ?? "",
    });
  } catch (err) {
    console.error("Listening generate error:", err);
    return NextResponse.json({ error: "Failed to generate listening session" }, { status: 500 });
  }
}
