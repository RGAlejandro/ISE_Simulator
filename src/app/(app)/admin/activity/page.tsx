import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ActivityClient } from "./activity-client";

export default async function AdminActivityPage() {
  await getAdminUser();

  const [users, written, oral, listening, grammar, saved] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, email: true, name: true, plan: true, createdAt: true },
    }),
    prisma.writtenExam.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, level: true, status: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.oralExam.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, level: true, status: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.listeningSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, level: true, status: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.grammarSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, cefrLevel: true, exerciseType: true, score: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.savedWord.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, english: true, level: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
  ]);

  type Event =
    | { kind: "signup";    id: string; createdAt: string; user: { email: string; name: string | null }; meta: { plan: string } }
    | { kind: "written";   id: string; createdAt: string; user: { email: string; name: string | null }; meta: { level: string; status: string } }
    | { kind: "oral";      id: string; createdAt: string; user: { email: string; name: string | null }; meta: { level: string; status: string } }
    | { kind: "listening"; id: string; createdAt: string; user: { email: string; name: string | null }; meta: { level: string; status: string } }
    | { kind: "grammar";   id: string; createdAt: string; user: { email: string; name: string | null }; meta: { cefrLevel: string; exerciseType: string; score: number | null } }
    | { kind: "vocab";     id: string; createdAt: string; user: { email: string; name: string | null }; meta: { english: string; level: string } };

  const events: Event[] = [
    ...users.map<Event>(u => ({ kind: "signup",    id: u.id, createdAt: u.createdAt.toISOString(), user: { email: u.email, name: u.name }, meta: { plan: u.plan } })),
    ...written.map<Event>(w => ({ kind: "written",   id: w.id, createdAt: w.createdAt.toISOString(), user: w.user, meta: { level: w.level, status: w.status } })),
    ...oral.map<Event>(o => ({ kind: "oral",      id: o.id, createdAt: o.createdAt.toISOString(), user: o.user, meta: { level: o.level, status: o.status } })),
    ...listening.map<Event>(l => ({ kind: "listening", id: l.id, createdAt: l.createdAt.toISOString(), user: l.user, meta: { level: l.level, status: l.status } })),
    ...grammar.map<Event>(g => ({ kind: "grammar",   id: g.id, createdAt: g.createdAt.toISOString(), user: g.user, meta: { cefrLevel: g.cefrLevel, exerciseType: g.exerciseType, score: g.score } })),
    ...saved.map<Event>(s => ({ kind: "vocab",     id: s.id, createdAt: s.createdAt.toISOString(), user: s.user, meta: { english: s.english, level: s.level } })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80);

  return <ActivityClient events={events} />;
}
