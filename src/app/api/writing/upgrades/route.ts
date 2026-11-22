import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { splitSentences } from "@/lib/reading";
import type { ExamLevel, WritingEvaluation, WritingUpgrade } from "@/types";

/** Auto-created list that collects Word Upgrade saves. */
const UPGRADES_LIST = { name: "Writing upgrades", emoji: "✍️", color: "amber" };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Example sentence that contains the chosen alternative — the vocabulary games
 * gap it out, so it must really be there.
 */
function exampleFor(upgrade: WritingUpgrade, suggestionIndex: number, draftText: string): string {
  const chosen = upgrade.suggestions[suggestionIndex].text;
  const first = upgrade.suggestions[0].text;
  if (upgrade.example) {
    if (suggestionIndex === 0 && upgrade.example.toLowerCase().includes(chosen.toLowerCase())) return upgrade.example;
    const re = new RegExp(escapeRegExp(first), "i");
    if (re.test(upgrade.example)) return upgrade.example.replace(re, chosen);
  }
  // Fall back to the candidate's own sentence with the quote swapped.
  const sentence =
    draftText
      .split(/\n+/)
      .flatMap((p) => splitSentences(p.replace(/\s+/g, " ").trim()))
      .find((s) => s.includes(upgrade.quote)) ?? upgrade.quote;
  return sentence.replace(upgrade.quote, chosen);
}

/** Save one Word Upgrade alternative into the learner's "Writing upgrades" list (no AI call needed). */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { draftId, upgradeIndex, suggestionIndex } = (await req.json()) as {
      draftId?: string; upgradeIndex?: number; suggestionIndex?: number;
    };
    if (!draftId || !Number.isInteger(upgradeIndex) || !Number.isInteger(suggestionIndex)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const draft = await prisma.writingDraft.findUnique({
      where: { id: draftId },
      include: { practice: { select: { userId: true, level: true } } },
    });
    if (!draft || draft.practice.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const feedback = draft.feedback as unknown as WritingEvaluation;
    const upgrade = feedback.upgrades?.[upgradeIndex!];
    const suggestion = upgrade?.suggestions?.[suggestionIndex!];
    if (!upgrade || !suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const list =
      (await prisma.vocabularyList.findFirst({ where: { userId: user.id, name: UPGRADES_LIST.name } })) ??
      (await prisma.vocabularyList.create({ data: { userId: user.id, ...UPGRADES_LIST } }));

    const english = suggestion.text.trim();
    const existing = await prisma.savedWord.findUnique({ where: { userId_english: { userId: user.id, english } } });
    if (existing) {
      // Already saved: leave it (and its review progress) where it is.
      return NextResponse.json({ saved: true, alreadyExisted: true, list: { id: list.id, name: list.name } });
    }

    await prisma.savedWord.create({
      data: {
        userId: user.id,
        listId: list.id,
        english,
        spanish: suggestion.translation || "—",
        example: exampleFor(upgrade, suggestionIndex!, draft.text),
        partOfSpeech: "phrase",
        level: getLevelSpec(draft.practice.level as ExamLevel).cefr,
        notes: [`"${upgrade.quote}" → "${english}"`, upgrade.note].filter(Boolean).join(" — ").slice(0, 500),
      },
    });

    return NextResponse.json({ saved: true, alreadyExisted: false, list: { id: list.id, name: list.name } });
  } catch (err) {
    console.error("Writing upgrade save error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
