/**
 * Showcase content for the demo cohort: real attempts of the student Lucía
 * (exams, Writing Lab texts with a rewrite, oral and live exams, listening,
 * a word list), produced once through the real app and saved to
 * demo-showcase.json. seed-demo-team.mjs re-imports it with fresh ids and dates
 * shifted to "now", so every demo morning has the same content — no AI calls.
 *
 *   node --env-file=.env.local prisma/demo-showcase.mjs export <ids.json>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = new URL("./demo-showcase.json", import.meta.url);
/** Foreign keys and back-relations: rebuilt on import. Ids are kept so demo URLs stay stable across re-seeds. */
const DROP = new Set(["userId", "examId", "practiceId", "listId", "user", "exam", "practice", "list", "paperSubmissions"]);
/** Child rows stored inside their parent. */
const CHILDREN = ["responses", "exchanges", "feedback", "drafts", "words"];

function pack(row, base, isChild = false) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (DROP.has(k) || v === null) continue;
    if (v instanceof Date) out[k] = { $ago: base - v.getTime() };
    else if (!isChild && CHILDREN.includes(k) && Array.isArray(v)) out[k] = v.map((c) => pack(c, base, true));
    else out[k] = v;
  }
  return out;
}

/** `feedback` is a relation on OralExam but a JSON field on WritingDraft: only strip child keys on top-level rows. */
function unpack(row, now, isChild = false) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isChild && CHILDREN.includes(k)) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && "$ago" in v ? new Date(now - v.$ago) : v;
  }
  return out;
}

export async function exportShowcase(prisma, ids) {
  const base = Date.now();
  const oralIds = [ids.oral, ids.live].filter(Boolean);
  const data = {
    version: 1,
    writingPractices: await prisma.writingPractice.findMany({ where: { id: { in: ids.writing ?? [] } }, include: { drafts: true }, orderBy: { createdAt: "asc" } }),
    writtenExams: await prisma.writtenExam.findMany({ where: { id: { in: [ids.written].filter(Boolean) } }, include: { responses: true } }),
    oralExams: await prisma.oralExam.findMany({ where: { id: { in: oralIds } }, include: { exchanges: true, feedback: true } }),
    listeningSessions: await prisma.listeningSession.findMany({ where: { id: { in: [ids.listening].filter(Boolean) } } }),
    vocabularyLists: await prisma.vocabularyList.findMany({ where: { id: { in: [ids.vocab].filter(Boolean) } }, include: { words: true } }),
  };
  for (const key of Object.keys(data)) if (Array.isArray(data[key])) data[key] = data[key].map((r) => pack(r, base));
  writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
  return Object.fromEntries(Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
}

/** Recreate the showcase for `userId`. Returns the number of top-level items created. */
export async function importShowcase(prisma, userId, now = Date.now()) {
  if (!existsSync(FILE)) return 0;
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  let n = 0;
  for (const p of data.writingPractices ?? []) {
    await prisma.writingPractice.create({ data: { ...unpack(p, now), userId, drafts: { create: (p.drafts ?? []).map((d) => unpack(d, now, true)) } } });
    n++;
  }
  for (const e of data.writtenExams ?? []) {
    await prisma.writtenExam.create({ data: { ...unpack(e, now), userId, responses: { create: (e.responses ?? []).map((r) => unpack(r, now, true)) } } });
    n++;
  }
  for (const e of data.oralExams ?? []) {
    await prisma.oralExam.create({
      data: {
        ...unpack(e, now),
        userId,
        exchanges: { create: (e.exchanges ?? []).map((x) => unpack(x, now, true)) },
        feedback: { create: (e.feedback ?? []).map((f) => unpack(f, now, true)) },
      },
    });
    n++;
  }
  for (const s of data.listeningSessions ?? []) {
    await prisma.listeningSession.create({ data: { ...unpack(s, now), userId } });
    n++;
  }
  for (const l of data.vocabularyLists ?? []) {
    const list = await prisma.vocabularyList.create({ data: { ...unpack(l, now), userId } });
    await prisma.savedWord.createMany({ data: (l.words ?? []).map((w) => ({ ...unpack(w, now, true), userId, listId: list.id })), skipDuplicates: true });
    n++;
  }
  return n;
}

// CLI: export the attempts listed in an ids file (written by the showcase generator).
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === "export") {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const ids = JSON.parse(readFileSync(process.argv[3], "utf8"));
  console.log("exported:", await exportShowcase(prisma, ids));
  await prisma.$disconnect();
}
