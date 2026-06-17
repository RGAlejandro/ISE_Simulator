import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateWithFileData } from "@/lib/gemini";
import { buildPaperGradingPrompt } from "@/lib/prompts/paper-exam";
import { getCurrentUser } from "@/lib/user";
import type { WrittenExamContent } from "@/types";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const examId = formData.get("examId") as string | null;
  const file = formData.get("file") as File | null;

  if (!examId || !file) {
    return NextResponse.json({ error: "Missing examId or file" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPEG, PNG, WebP, or PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const exam = await prisma.writtenExam.findUnique({
    where: { id: examId, userId: user.id },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const content = exam.content as unknown as WrittenExamContent;
  const prompt = buildPaperGradingPrompt(content);

  let feedback: Record<string, unknown>;
  try {
    feedback = (await generateWithFileData(prompt, { data: base64, mimeType: file.type })) as Record<string, unknown>;
  } catch (err) {
    console.error("[paper-grade] Gemini error:", err);
    return NextResponse.json({ error: "AI grading failed. Try again." }, { status: 502 });
  }

  const score = typeof feedback.overallScore === "number" ? feedback.overallScore : null;

  const submission = await prisma.paperSubmission.create({
    data: {
      userId: user.id,
      examId,
      level: exam.level,
      feedback: feedback as object,
      score,
      status: "GRADED",
    },
  });

  return NextResponse.json({ submissionId: submission.id, feedback, score });
}
