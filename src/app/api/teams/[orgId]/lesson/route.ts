import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { EXAM_LEVELS } from "@/lib/constants";
import { getMembership, getTeamDashboard, isTeacherRole } from "@/lib/teams-server";
import { HEATMAP_CRITERIA } from "@/lib/teams";
import { getTeamLessonPrompt, sanitizeLesson, type LessonFocus } from "@/lib/prompts/team-lesson";
import type { Prisma } from "@prisma/client";

const MAX_LESSONS_PER_DAY = 5;

const CRITERION_EN: Record<string, string> = {
  communicativeEffectiveness: "Communicative effectiveness",
  interactiveListening: "Interactive listening",
  languageControl: "Language control",
  delivery: "Delivery",
  taskFulfilment: "Task fulfilment",
  organisation: "Organisation & structure",
  readingForWriting: "Reading into writing",
};

/** Generate a mini-lesson from the class's aggregated weaknesses (no student text is sent). */
export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await params;
    const membership = await getMembership(user.id, orgId);
    if (!isTeacherRole(membership?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const since = new Date(Date.now() - 86_400_000);
    if ((await prisma.teamLesson.count({ where: { orgId, createdAt: { gte: since } } })) >= MAX_LESSONS_PER_DAY) {
      return NextResponse.json({ error: "Daily lesson limit reached for this team" }, { status: 429 });
    }

    const dash = await getTeamDashboard(orgId);
    if (!dash) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Class average per heatmap criterion, weakest first.
    const criteria = HEATMAP_CRITERIA.map((h, col) => {
      const vals = dash.members.map((m) => m.cells[col]).filter((v): v is number => v !== null);
      return { label: `${h.skill === "speaking" ? "Speaking" : "Writing"} · ${CRITERION_EN[h.key] ?? h.key}`, value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    })
      .filter((c): c is { label: string; value: number } => c.value !== null)
      .sort((a, b) => a.value - b.value)
      .slice(0, 3);

    if (criteria.length === 0 && dash.classErrors.length === 0) {
      return NextResponse.json({ error: "Not enough marked work in the class yet" }, { status: 400 });
    }

    const focus: LessonFocus = {
      level: dash.org.level,
      cefr: EXAM_LEVELS.find((l) => l.value === dash.org.level)?.cefr ?? "",
      students: dash.kpis.students,
      criteria,
      errors: dash.classErrors.slice(0, 4).map((e) => ({ tag: e.tag, students: e.students, occurrences: e.occurrences })),
    };

    const raw = await generateJSON(getTeamLessonPrompt(focus), { temperature: 0.6, prefer: "gemini" });
    const content = sanitizeLesson(raw);
    if (!content) return NextResponse.json({ error: "The lesson came back incomplete. Try again." }, { status: 502 });

    const lesson = await prisma.teamLesson.create({
      data: { orgId, createdById: user.id, focus: focus as unknown as Prisma.InputJsonValue, content: content as unknown as Prisma.InputJsonValue },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ id: lesson.id, createdAt: lesson.createdAt.toISOString(), content, focus });
  } catch (error) {
    console.error("Error generating team lesson:", error);
    return NextResponse.json({ error: "Could not generate the lesson" }, { status: 500 });
  }
}
