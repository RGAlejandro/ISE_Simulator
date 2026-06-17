import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

/**
 * Soft-delete an exam: hides it from the user's lists but keeps the row in the
 * database. Scoped to the owner so users can only hide their own exams.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = (await req.json().catch(() => ({}))) as { type?: string; id?: string };
  if ((type !== "written" && type !== "oral") || !id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const now = new Date();
  const where = { id, userId: user.id };
  const result =
    type === "written"
      ? await prisma.writtenExam.updateMany({ where, data: { hiddenAt: now } })
      : await prisma.oralExam.updateMany({ where, data: { hiddenAt: now } });

  if (result.count === 0) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
