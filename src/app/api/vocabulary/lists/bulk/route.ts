import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/user";
import { MAX_BULK_WORDS, MAX_LIST_NAME, sanitizeWords } from "@/lib/tutor";
import { createListWithWords } from "@/lib/vocab-lists";

/**
 * Create a list and its words in one go — used when the learner confirms a
 * list proposed by the tutor (e.g. read from photos of their flashcards).
 * The words arrive already translated, so no AI call happens here. Words the
 * learner has already saved are skipped, not moved from their current list.
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let body: { name?: unknown; emoji?: unknown; words?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
    if (!name || name.length > MAX_LIST_NAME) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (Array.isArray(body.words) && body.words.length > MAX_BULK_WORDS) {
      return NextResponse.json({ error: `Up to ${MAX_BULK_WORDS} words per list` }, { status: 400 });
    }
    const words = sanitizeWords(body.words, MAX_BULK_WORDS);
    if (words.length === 0) {
      return NextResponse.json({ error: "Select at least one word" }, { status: 400 });
    }
    const emoji = typeof body.emoji === "string" && body.emoji.length <= 4 ? body.emoji : "✨";

    const { list, added, skipped } = await createListWithWords(user.id, name, emoji, words);

    return NextResponse.json({
      list: { id: list.id, name: list.name, emoji: list.emoji, color: list.color, wordCount: added },
      added,
      skipped,
    });
  } catch (err) {
    console.error("Bulk list error:", err);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
