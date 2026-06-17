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

/** Canonical Trinity task order. Tasks the user didn't select are skipped. */
const CANONICAL_ORDER: OralTaskType[] = ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];

/**
 * Exchange budget per speaking task, scaled to the official Trinity per-level
 * durations (Guide for Students): ~1.5 exchanges per official minute.
 * ISE III/IV Topic is a formal presentation + discussion (8/10 min), so it gets
 * a much larger budget than the 4-minute Topic at Foundation–ISE II.
 */
const EXCHANGE_BUDGET: Record<ExamLevel, Partial<Record<OralTaskType, number>>> = {
  ISE_FOUNDATION: { TOPIC: 6, CONVERSATION: 4 },
  ISE_I:          { TOPIC: 6, CONVERSATION: 4 },
  ISE_II:         { TOPIC: 6, COLLABORATIVE: 6, CONVERSATION: 4 },
  ISE_III:        { TOPIC: 10, COLLABORATIVE: 6, CONVERSATION: 5 },
  ISE_IV:         { TOPIC: 12, COLLABORATIVE: 7, CONVERSATION: 6 },
};

function exchangeBudget(level: ExamLevel, task: OralTaskType): number {
  return EXCHANGE_BUDGET[level]?.[task] ?? 6;
}

/** Return the next selected task after `current`, or null when the exam ends. */
function getNextTask(selectedTasks: string[], current: OralTaskType): OralTaskType | null {
  const selected = selectedTasks.filter((t): t is OralTaskType =>
    (CANONICAL_ORDER as string[]).includes(t),
  );
  const ordered = CANONICAL_ORDER.filter(t => selected.includes(t));
  const idx = ordered.indexOf(current);
  if (idx === -1 || idx === ordered.length - 1) return null;
  return ordered[idx + 1];
}

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
    const { examId, taskType, candidateText, exchangeCount, endTask } = body as {
      examId?: string;
      taskType?: string;
      candidateText?: string;
      exchangeCount?: number;
      /** Client timer expired — close this task after the current turn (formal Topic levels). */
      endTask?: boolean;
    };

    if (!examId || !taskType || (typeof candidateText !== "string" && endTask !== true)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const exam = await prisma.oralExam.findUnique({
      where: { id: examId, userId: user.id },
      include: { exchanges: { orderBy: { order: "asc" } } },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const candidateTurn = (candidateText ?? "").trim();

    // Save candidate's response (skip when the timer expired with no final answer)
    const nextOrder = exam.exchanges.length;
    if (candidateTurn) {
      await prisma.oralExchange.create({
        data: {
          examId,
          taskType: taskType as OralTaskType,
          role: "CANDIDATE",
          content: candidateTurn,
          order: nextOrder,
        },
      });
    }

    // Build conversation history for this task
    const taskExchanges = exam.exchanges.filter((e: typeof exam.exchanges[number]) => e.taskType === taskType);
    const conversationHistory = [
      ...taskExchanges.map((e: typeof exam.exchanges[number]) => `${e.role === "EXAMINER" ? "Examiner" : "Candidate"}: ${e.content}`),
      ...(candidateTurn ? [`Candidate: ${candidateTurn}`] : []),
    ].join("\n");

    const systemPrompt = getOralExaminerSystemPrompt(exam.level as ExamLevel);
    let userPrompt: string;
    let isTaskTransition = false;
    let nextTask: OralTaskType | null = null;
    let listeningData: { listeningText?: string; introduction?: string; questions?: string[] } | null = null;

    const taskExchangeCount = exchangeCount || taskExchanges.length + 1;

    // Dynamic transitions based on selectedTasks (skip tasks user opted out of)
    const selectedTasks = exam.selectedTasks?.length
      ? exam.selectedTasks
      : (CANONICAL_ORDER as string[]); // backward-compat for old exams w/o selectedTasks

    const buildTransitionPrompt = (target: OralTaskType): string => {
      switch (target) {
        case "COLLABORATIVE": return getCollaborativeTaskPrompt(exam.level as ExamLevel);
        case "CONVERSATION":  return getConversationTaskPrompt(exam.level as ExamLevel);
        // TOPIC + LISTENING handled out-of-band below (TOPIC = examiner opens at exam start, LISTENING has dedicated branch)
        case "TOPIC":         return "Let's begin the Topic task. Please tell me about the topic you have prepared.";
        case "LISTENING":     return "Now we will move to the listening task.";
      }
    };

    // Topic preparation captured at setup
    const topicPrep = {
      general: exam.topicGeneral,
      detailed: exam.topicDetailed,
    };

    // Determine what the examiner should say next
    if (taskType === "TOPIC") {
      if (endTask === true || taskExchangeCount >= exchangeBudget(exam.level as ExamLevel, "TOPIC")) {
        const target = getNextTask(selectedTasks, "TOPIC");
        if (target === null) {
          // No further tasks — wrap up
          const thanks = "Thank you. That concludes your speaking exam. Well done — your results will be available shortly.";
          await prisma.oralExchange.create({
            data: { examId, taskType: "TOPIC", role: "EXAMINER", content: thanks, order: nextOrder + 1 },
          });
          return NextResponse.json({ examinerMessage: thanks, taskType: "TOPIC", isExamFinished: true });
        }
        isTaskTransition = true;
        nextTask = target;
        userPrompt = buildTransitionPrompt(target);
      } else {
        userPrompt = getTopicFollowUpPrompt(exam.level as ExamLevel, conversationHistory, topicPrep);
      }
    } else if (taskType === "COLLABORATIVE") {
      if (endTask === true || taskExchangeCount >= exchangeBudget(exam.level as ExamLevel, "COLLABORATIVE")) {
        const target = getNextTask(selectedTasks, "COLLABORATIVE");
        if (target === null) {
          const thanks = "Thank you. That concludes your speaking exam. Well done — your results will be available shortly.";
          await prisma.oralExchange.create({
            data: { examId, taskType: "COLLABORATIVE", role: "EXAMINER", content: thanks, order: nextOrder + 1 },
          });
          return NextResponse.json({ examinerMessage: thanks, taskType: "COLLABORATIVE", isExamFinished: true });
        }
        isTaskTransition = true;
        nextTask = target;
        userPrompt = buildTransitionPrompt(target);
      } else {
        userPrompt = getCollaborativeFollowUpPrompt(exam.level as ExamLevel, conversationHistory);
      }
    } else if (taskType === "CONVERSATION") {
      if (endTask === true || taskExchangeCount >= exchangeBudget(exam.level as ExamLevel, "CONVERSATION")) {
        const target = getNextTask(selectedTasks, "CONVERSATION");
        if (target === null) {
          const thanks = "Thank you. That concludes your speaking exam. Well done — your results will be available shortly.";
          await prisma.oralExchange.create({
            data: { examId, taskType: "CONVERSATION", role: "EXAMINER", content: thanks, order: nextOrder + 1 },
          });
          return NextResponse.json({ examinerMessage: thanks, taskType: "CONVERSATION", isExamFinished: true });
        }
        if (target === "LISTENING") {
          // Transition to Listening — generate content + return early
          isTaskTransition = true;
          nextTask = "LISTENING";

          listeningData = await generateChatJSON(
            systemPrompt,
            getListeningTaskPrompt(exam.level as ExamLevel),
            { temperature: 0.7 },
          );
          userPrompt = listeningData?.introduction || "Now we will move to the listening task.";

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
        }
        isTaskTransition = true;
        nextTask = target;
        userPrompt = buildTransitionPrompt(target);
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
        candidateTurn
      );
    } else {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    // Generate examiner response (unless we already returned for listening transition)
    let examinerResponse = await generateChat(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 250,
    });

    // Safety net: in the Collaborative task the examiner must NEVER ask questions
    // (the candidate leads). If a follow-up turn ends with a question, regenerate once.
    const isCollaborativeTurn =
      !isTaskTransition && (isTaskTransition ? nextTask : taskType) === "COLLABORATIVE";
    if (isCollaborativeTurn && examinerResponse.trim().endsWith("?")) {
      examinerResponse = await generateChat(
        systemPrompt,
        userPrompt + "\n\nIMPORTANT: Your previous attempt ended with a question. Respond again using STATEMENTS ONLY — absolutely no questions and no question marks.",
        { temperature: 0.6, maxTokens: 250 },
      );
    }

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
