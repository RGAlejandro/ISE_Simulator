import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

const VALID_PLANS = ["FREE", "PRO", "ADMIN"] as const;
type ValidPlan = (typeof VALID_PLANS)[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getCurrentUser();
  if (!me || me.plan !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as { plan?: string };
  if (!body.plan || !VALID_PLANS.includes(body.plan as ValidPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (id === me.id && body.plan !== "ADMIN") {
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { plan: body.plan as ValidPlan },
    select: { id: true, plan: true },
  });

  return NextResponse.json({ user: updated });
}
