import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat, generateChatJSON } from "@/lib/ai-provider";
import { getCurrentUser } from "@/lib/user";
import {
  getOralExaminerSystemPrompt,
  getTopicFollowUpPrompt,
  getCollaborativeTaskPrompt,
  getCollaborativeFollowUpPrompt,
  getConversationTaskPrompt,
  getConversationFollowUpPrompt,
  getListeningTaskPrompt,
  getListeningFollowUpPrompt,
} from "@/lib/prompts/oral-exam";
import type { ExamLevel, OralTaskType } from "@/types";

export async function POST(req: NextRequest) {
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
    const { examId, taskType, candidateText, exchangeCount } = body;

    if (!examId || !taskType || typeof candidateText !== "string") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const exam = await prisma.oralExam.findUnique({
      where: { id: examId, userId: user.id },
      include: { exchanges: { orderBy: { order: "asc" } } },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Save candidate's response
    const nextOrder = exam.exchanges.length;
    await prisma.oralExchange.create({
      data: {
        examId,
        taskType: taskType as OralTaskType,
        role: "CANDIDATE",
        content: candidateText,
        order: nextOrder,
      },
    });

    // Build conversation history for this task
    const taskExchanges = exam.exchanges.filter((e: typeof exam.exchanges[number]) => e.taskType === taskType);
    const conversationHistory = [
      ...taskExchanges.map((e: typeof exam.exchanges[number]) => `${e.role === "EXAMINER" ? "Examiner" : "Candidate"}: ${e.content}`),
      `Candidate: ${candidateText}`,
    ].join("\n");

    const systemPrompt = getOralExaminerSystemPrompt(exam.level as ExamLevel);
    let userPrompt: string;
    let isTaskTransition = false;
    let nextTask: OralTaskType | null = null;
    let listeningData: { listeningText?: string; introduction?: string; questions?: string[] } | null = null;

    const taskExchangeCount = exchangeCount || taskExchanges.length + 1;

    // Determine what the examiner should say next
    if (taskType === "TOPIC") {
      if (taskExchangeCount >= 6) {
        // Transition to Collaborative Task
        isTaskTransition = true;
        nextTask = "COLLABORATIVE";
        userPrompt = getCollaborativeTaskPrompt(exam.level as ExamLevel);
      } else {
        userPrompt = getTopicFollowUpPrompt(exam.level as ExamLevel, conversationHistory);
      }
    } else if (taskType === "COLLABORATIVE") {
      if (taskExchangeCount >= 6) {
        isTaskTransition = true;
        nextTask = "CONVERSATION";
        userPrompt = getConversationTaskPrompt(exam.level as ExamLevel);
      } else {
        userPrompt = getCollaborativeFollowUpPrompt(exam.level as ExamLevel, conversationHistory);
      }
    } else if (taskType === "CONVERSATION") {
      if (taskExchangeCount >= 6) {
        // Transition to Listening Task — need to generate listening content
        isTaskTransition = true;
        nextTask = "LISTENING";

        listeningData = await generateChatJSON(
          systemPrompt,
          getListeningTaskPrompt(exam.level as ExamLevel),
          { temperature: 0.7 }
        );
        userPrompt = listeningData?.introduction || "Now we will move to the listening task.";

        // Save listening data as a special exchange
        await prisma.oralExchange.create({
          data: {
            examId,
            taskType: "LISTENING",
            role: "EXAMINER",
            content: JSON.stringify(listeningData),
            order: nextOrder + 1,
          },
        });

        return NextResponse.json({
          examinerMessage: listeningData?.introduction || "",
          taskType: "LISTENING",
          isTaskTransition: true,
          listeningData,
        });
      } else {
        userPrompt = getConversationFollowUpPrompt(exam.level as ExamLevel, conversationHistory);
      }
    } else if (taskType === "LISTENING") {
      // Find the listening questions from the stored data
      const listeningExchange = exam.exchanges.find(
        (e: typeof exam.exchanges[number]) => e.taskType === "LISTENING" && e.role === "EXAMINER"
      );
      let questions: string[] = [];
      if (listeningExchange) {
        try {
          const data = JSON.parse(listeningExchange.content);
          questions = data.questions || [];
        } catch {
          // ignore parse error
        }
      }

      const questionIndex = Math.floor(
        taskExchanges.filter((e: typeof exam.exchanges[number]) => e.role === "CANDIDATE").length
      );

      if (questionIndex >= questions.length || taskExchangeCount >= 8) {
        // Exam is complete
        const thankYou =
          "Thank you very much. That concludes your speaking exam. You did well. Your results will be available shortly.";
        await prisma.oralExchange.create({
          data: {
            examId,
            taskType: "LISTENING",
            role: "EXAMINER",
            content: thankYou,
            order: nextOrder + 1,
          },
        });

        return NextResponse.json({
          examinerMessage: thankYou,
          taskType: "LISTENING",
          isExamFinished: true,
        });
      }

      const currentQuestion = questions[questionIndex] || "";
      userPrompt = getListeningFollowUpPrompt(
        exam.level as ExamLevel,
        currentQuestion,
        candidateText
      );
    } else {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    // Generate examiner response (unless we already returned for listening transition)
    const examinerResponse = await generateChat(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 250,
    });

    // Save examiner's response
    await prisma.oralExchange.create({
      data: {
        examId,
        taskType: (isTaskTransition ? nextTask : taskType) as OralTaskType,
        role: "EXAMINER",
        content: examinerResponse,
        order: nextOrder + 1,
      },
    });

    return NextResponse.json({
      examinerMessage: examinerResponse,
      taskType: isTaskTransition ? nextTask : taskType,
      isTaskTransition,
    });
  } catch (error) {
    console.error("Error in oral respond:", error);
    return NextResponse.json({ error: "Failed to process response" }, { status: 500 });
  }
}
