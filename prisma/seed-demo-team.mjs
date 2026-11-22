/**
 * Demo cohort for the Teams panel: "Demo Academy · ISE III" with 12 fictional
 * students and 8 weeks of marked practice (Writing Lab drafts, oral exams,
 * listening sessions, reading mocks), plus three assignments.
 *
 *   npm run demo:seed            # (re)create — idempotent
 *   npm run demo:seed -- --remove  # delete the demo cohort and its users
 *
 * Demo users have clerkId "demo_*" and @demo.invalid emails: they can't sign
 * in and are removed in cascade. The owner is the first ADMIN user (or the
 * email given with --owner=<email>). Deterministic (seeded PRNG).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JOIN_CODE = "ACADEMY3";
const LEVEL = "ISE_III";
const DAY = 86_400_000;
const now = new Date();

// ─── deterministic randomness ───────────────────────────────────────────────
let seed = 20261202;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const noise = (amp) => (rand() * 2 - 1) * amp;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Inverse of the readiness band maps: band value (50 = Pass) → raw score on a task's own scale. */
function fromBand(value, anchors) {
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (value <= y1) return x0 + ((value - y0) / (y1 - y0)) * (x1 - x0);
  }
  return anchors[anchors.length - 1][0];
}
const WRITING = [[0, 0], [2, 50], [2.5, 65], [3.5, 80], [4, 100]];
const SPOKEN = [[0, 0], [10, 50], [13, 65], [17, 80], [20, 100]];

// ─── cohort design (tells a story: a few ready, most near the line, some struggling) ──
// base = band-scale level 8 weeks ago per skill [reading, writing, speaking, listening]; growth = points/week; p = weekly activity.
const STUDENTS = [
  { name: "Lucía Martín", base: [70, 62, 68, 66], growth: 1.4, p: 0.95, errors: ["articles", "collocation"] },
  { name: "Javier Ortega", base: [66, 58, 72, 70], growth: 1.2, p: 0.85, errors: ["prepositions", "word-order"] },
  { name: "Marta Gil", base: [72, 66, 64, 71], growth: 0.9, p: 0.8, errors: ["collocation", "register"] },
  { name: "Daniel Ruiz", base: [58, 47, 60, 55], growth: 1.8, p: 0.9, errors: ["verb-tense", "articles", "prepositions"] },
  { name: "Sara Navarro", base: [60, 49, 55, 58], growth: 1.6, p: 0.75, errors: ["articles", "sentence-structure"] },
  { name: "Pablo Herrera", base: [55, 45, 58, 52], growth: 2.2, p: 0.9, errors: ["verb-tense", "word-order", "linking"] },
  { name: "Elena Castro", base: [62, 52, 50, 60], growth: 1.0, p: 0.65, errors: ["prepositions", "collocation"] },
  { name: "Andrés Molina", base: [57, 50, 61, 47], growth: 0.8, p: 0.6, errors: ["articles", "verb-form"] },
  { name: "Carmen Vidal", base: [52, 42, 48, 50], growth: 1.5, p: 0.7, errors: ["verb-tense", "articles", "spelling"] },
  { name: "Hugo Serrano", base: [50, 40, 52, 44], growth: 0.4, p: 0.45, errors: ["subject-verb-agreement", "articles"] },
  { name: "Irene Prieto", base: [48, 44, 46, 49], growth: 0.6, p: 0.5, errors: ["word-order", "prepositions", "verb-tense"] },
  { name: "Tomás Rey", base: [0, 0, 0, 0], growth: 0, p: 0, errors: [] }, // joined, hasn't started
];

const SUBJECTS = ["Independence", "Ambition", "Society and living standards", "Personal values and ideals", "The world of work", "Education"];
const GENRES = ["essay", "article", "review", "report", "email"];

function writingFeedback(mean04, errors, riw) {
  const crit = (offset) => ({ score: clamp(Math.round(mean04 + offset + noise(0.4)), 0, 4), comment: "Demo cohort feedback." });
  const criteria = { taskFulfilment: crit(0.2), organisation: crit(-0.45), languageControl: crit(-0.15) };
  if (riw) criteria.readingForWriting = crit(0.1);
  const tags = [...errors, ...errors, pick(["word-choice", "linking", "punctuation", "repetition", "collocation"])];
  const n = 3 + Math.floor(rand() * 4);
  const issues = Array.from({ length: n }, () => {
    const tag = pick(tags);
    return { start: 0, end: 0, quote: "", category: tag === "spelling" || tag === "punctuation" ? tag : "grammar", tag, explanation: "", correction: "" };
  });
  return { criteria, summary: "Demo cohort feedback.", strengths: [], issues, upgrades: [], improvedVersion: "", nextSteps: [] };
}

function spokenFeedback(score20, interactiveDip) {
  const per = score20 / 4;
  const c = (offset) => ({ score: clamp(Math.round(per + offset + noise(0.5)), 0, 5), comments: "Demo cohort feedback." });
  const fb = { communicativeEffectiveness: c(0.2), interactiveListening: c(-interactiveDip), languageControl: c(-0.2), delivery: c(0.1), suggestions: [] };
  const score = fb.communicativeEffectiveness.score + fb.interactiveListening.score + fb.languageControl.score + fb.delivery.score;
  return { ...fb, score, band: score >= 17 ? "Distinction" : score >= 13 ? "Merit" : score >= 10 ? "Pass" : "Fail", summary: "Demo cohort feedback." };
}

async function removeDemo() {
  await prisma.organization.deleteMany({ where: { joinCode: JOIN_CODE } });
  const { count } = await prisma.user.deleteMany({ where: { clerkId: { startsWith: "demo_" } } });
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const removed = await removeDemo();
  if (args.includes("--remove")) {
    console.log(`Removed demo cohort (${removed} demo users).`);
    return;
  }

  const ownerEmail = args.find((a) => a.startsWith("--owner="))?.slice(8);
  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : await prisma.user.findFirst({ where: { plan: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("No owner found: pass --owner=<email> of an existing user");

  const org = await prisma.organization.create({
    data: { name: "Demo Academy · ISE III", level: LEVEL, joinCode: JOIN_CODE, ownerId: owner.id, members: { create: { userId: owner.id, role: "OWNER" } } },
  });

  let attempts = 0;
  for (const [i, s] of STUDENTS.entries()) {
    const slug = s.name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/ /g, ".");
    const user = await prisma.user.create({
      data: {
        clerkId: `demo_${slug}`,
        email: `${slug}@demo.invalid`,
        name: s.name,
        examLevel: LEVEL,
        examDate: new Date(Date.UTC(2026, 11, 2 + (i % 3) * 7)),
        createdAt: new Date(now.getTime() - 60 * DAY),
      },
    });
    await prisma.orgMember.create({ data: { orgId: org.id, userId: user.id, role: "STUDENT", joinedAt: new Date(now.getTime() - (s.p ? 58 : 2) * DAY) } });

    for (let w = 7; w >= 0; w--) {
      const weekStart = now.getTime() - (w + 1) * 7 * DAY;
      const level = (k) => clamp(s.base[k] + s.growth * (7 - w) + noise(6), 15, 98);
      const at = () => new Date(Math.min(now.getTime() - 3600_000, weekStart + rand() * 7 * DAY));

      // Writing Lab: the most frequent activity.
      const drafts = rand() < s.p ? (rand() < 0.4 ? 2 : 1) : 0;
      for (let d = 0; d < drafts; d++) {
        const riw = rand() < 0.4;
        const mean = Math.round(clamp(fromBand(level(1), WRITING), 0.5, 4) * 100) / 100;
        const date = at();
        await prisma.writingPractice.create({
          data: {
            userId: user.id, level: LEVEL, taskType: riw ? "READING_INTO_WRITING" : "EXTENDED_WRITING",
            genre: pick(GENRES), topic: pick(SUBJECTS), task: { title: "Demo task" }, createdAt: date,
            drafts: { create: { version: 1, text: "Demo cohort text.", wordCount: 210 + Math.floor(rand() * 40), feedback: writingFeedback(mean, s.errors, riw), score: mean, createdAt: date } },
          },
        });
        attempts++;
      }

      // Oral exam (3 spoken tasks), sometimes with Independent Listening.
      if (rand() < s.p * 0.6) {
        const date = at();
        const tasks = ["TOPIC", "COLLABORATIVE", "CONVERSATION"];
        const feedback = tasks.map((taskType) => {
          const fb = spokenFeedback(clamp(fromBand(level(2), SPOKEN), 4, 20), 0.6 + rand() * 0.6);
          return { taskType, feedback: fb, score: fb.score };
        });
        if (rand() < 0.5) {
          const l5 = clamp(Math.round((level(3) / 100) * 5 + noise(0.6)), 0, 5);
          feedback.push({ taskType: "LISTENING", feedback: { listening: { score: l5, comments: "Demo." }, score: l5, band: l5 >= 3 ? "Pass" : "Fail" }, score: l5 });
        }
        const overall = Math.round(feedback.reduce((a, f) => a + (f.taskType === "LISTENING" ? f.score / 5 : f.score / 20) * 100, 0) / feedback.length);
        await prisma.oralExam.create({
          data: {
            userId: user.id, level: LEVEL, status: "EVALUATED", mode: rand() < 0.5 ? "live" : "classic", overallScore: overall,
            selectedTasks: feedback.map((f) => f.taskType), startedAt: date, completedAt: date, createdAt: date,
            feedback: { create: feedback.map((f) => ({ ...f, createdAt: date })) },
          },
        });
        attempts++;
      }

      // Listening sessions.
      if (rand() < s.p * 0.5) {
        const date = at();
        const pct = Math.round(clamp(level(3) + noise(4), 5, 98));
        await prisma.listeningSession.create({
          data: {
            userId: user.id, level: LEVEL, status: "COMPLETED", passageText: "Demo passage.", passageTitle: "Demo listening", passageTopic: pick(SUBJECTS),
            round1Response: "The speaker talks about how work is changing and gives two main reasons with examples.",
            round2Response: "Notes on the details and the speaker's opinion.", round1Score: Math.round((pct / 100) * 10), round2Score: Math.round((pct / 100) * 15),
            overallScore: pct, startedAt: date, completedAt: date, createdAt: date,
          },
        });
        attempts++;
      }

      // Reading mock (written exam, reading part): roughly every third week for active students.
      if ((s.p > 0 && w % 3 === 1 && rand() < s.p + 0.15) || rand() < s.p * 0.15) {
        const date = at();
        const correct = () => clamp(Math.round(((level(0) + noise(5)) / 100) * 15), 2, 15);
        const r1 = correct();
        const r2 = correct();
        await prisma.writtenExam.create({
          data: {
            userId: user.id, level: LEVEL, status: "EVALUATED", content: { demo: true }, score: Math.round(((r1 + r2) / 30) * 50),
            startedAt: date, completedAt: date, createdAt: date,
            responses: {
              create: [
                { taskType: "READING_1", taskNumber: 1, response: "{}", score: r1, createdAt: date },
                { taskType: "READING_2", taskNumber: 2, response: "{}", score: r2, createdAt: date },
              ],
            },
          },
        });
        attempts++;
      }
    }
  }

  const endOfDay = (days) => {
    const d = new Date(now.getTime() + days * DAY);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  };
  await prisma.assignment.createMany({
    data: [
      { orgId: org.id, createdById: owner.id, kind: "WRITING", title: "Opinion essay: is remote work here to stay?", createdAt: new Date(now.getTime() - 6 * DAY), dueAt: endOfDay(2) },
      { orgId: org.id, createdById: owner.id, kind: "ORAL", title: "Live oral: lead the Collaborative task", createdAt: new Date(now.getTime() - 4 * DAY), dueAt: endOfDay(5) },
      { orgId: org.id, createdById: owner.id, kind: "LISTENING", title: "Listening mock (ISE III)", createdAt: new Date(now.getTime() - 16 * DAY), dueAt: endOfDay(-8) },
    ],
  });

  console.log(`Demo cohort ready: "${org.name}" — ${STUDENTS.length} students, ${attempts} marked attempts, owner ${owner.email.replace(/^[^@]{0,3}[^@]*/, "***")}`);
  console.log(`Panel: /teams/${org.id}   Invite: /teams/join/${JOIN_CODE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
