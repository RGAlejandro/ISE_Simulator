import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow deleting the user's own exam
  await prisma.writtenExam.deleteMany({
    where: { id: examId, userId: user.id },
  });

  return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL!));
}
