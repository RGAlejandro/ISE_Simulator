import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser, isProUser } from "@/lib/user";

export const OFFICIAL_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
/** Gemini's inline-data request cap is ~20 MB. */
const MAX_TOTAL = 18 * 1024 * 1024;
const MAX_FILES = 15;

/** Signed-in Pro user, or the response to send instead. */
export async function requireProUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  if (!isProUser(user)) return { error: NextResponse.json({ error: "Pro feature", upsell: true }, { status: 403 }) };
  return { user };
}

/** Validate uploads and turn them into inline parts for Gemini. */
export async function readUploads(files: File[]): Promise<{ parts: { data: string; mimeType: string }[] } | { error: string }> {
  if (files.length === 0) return { error: "files" };
  if (files.length > MAX_FILES) return { error: "files" };
  let total = 0;
  for (const f of files) {
    if (!OFFICIAL_FILE_TYPES.includes(f.type)) return { error: "files" };
    total += f.size;
  }
  if (total > MAX_TOTAL) return { error: "files" };
  const parts = await Promise.all(files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type })));
  return { parts };
}
