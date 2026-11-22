import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { generateJoinCode } from "@/lib/teams";
import type { ExamLevel } from "@/types";

const MAX_OWNED_TEAMS = 10;

/** Create a team; the creator becomes its OWNER. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { name?: string; level?: string };
    const name = (body.name ?? "").trim().slice(0, 80);
    const level = EXAM_LEVELS.find((l) => l.value === body.level)?.value as ExamLevel | undefined;
    if (name.length < 2) return NextResponse.json({ error: "Give the team a name" }, { status: 400 });
    if (!level) return NextResponse.json({ error: "Invalid level" }, { status: 400 });

    const owned = await prisma.organization.count({ where: { ownerId: user.id } });
    if (owned >= MAX_OWNED_TEAMS) return NextResponse.json({ error: "Team limit reached" }, { status: 429 });

    // Retry on the (unlikely) join-code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const org = await prisma.organization.create({
          data: { name, level, joinCode: generateJoinCode(), ownerId: user.id, members: { create: { userId: user.id, role: "OWNER" } } },
          select: { id: true },
        });
        return NextResponse.json({ id: org.id });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
    return NextResponse.json({ error: "Could not create the team" }, { status: 500 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Could not create the team" }, { status: 500 });
  }
}
