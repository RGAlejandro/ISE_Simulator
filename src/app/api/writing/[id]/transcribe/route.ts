import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist, getCurrentUser, isProUser } from "@/lib/user";
import { generateWithFiles } from "@/lib/gemini";
import { getHandwritingTranscriptionPrompt } from "@/lib/prompts/writing";
import { MAX_TEXT_CHARS, cleanTranscription } from "@/lib/writing";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILES = 3;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
/** Gemini's inline-data request cap is ~20 MB. */
const MAX_TOTAL_SIZE = 18 * 1024 * 1024;

/**
 * Paper practice: transcribe photos of a handwritten answer exactly as
 * written (mistakes included). Nothing is stored — the learner checks the
 * transcription and then submits it as a normal draft.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const practice = await prisma.writingPractice.findUnique({ where: { id }, select: { userId: true, hiddenAt: true } });
    if (!practice || practice.userId !== user.id || practice.hiddenAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: "Add at least one photo" }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Up to ${MAX_FILES} photos` }, { status: 400 });

    let total = 0;
    for (const f of files) {
      if (!ALLOWED_MIME_TYPES.includes(f.type)) {
        return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, WebP or HEIC photos." }, { status: 400 });
      }
      if (f.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Photo too large (max 8 MB each)" }, { status: 400 });
      total += f.size;
    }
    if (total > MAX_TOTAL_SIZE) return NextResponse.json({ error: "Photos too large in total" }, { status: 400 });

    if (!(await consumeAiAssist(user.id, isProUser(user)))) {
      return NextResponse.json({ error: "Daily limit for AI helpers reached. Try again tomorrow." }, { status: 429 });
    }

    const parts = await Promise.all(
      files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type })),
    );

    let result: { text?: unknown; illegible?: unknown; isHandwrittenText?: unknown };
    try {
      result = (await generateWithFiles(getHandwritingTranscriptionPrompt(), parts, { temperature: 0 })) as typeof result;
    } catch (err) {
      console.error("[writing-transcribe] Gemini error:", err);
      return NextResponse.json({ error: "Couldn't read the photos. Try again." }, { status: 502 });
    }

    const text = typeof result.text === "string" ? cleanTranscription(result.text).slice(0, MAX_TEXT_CHARS) : "";
    if (!text || result.isHandwrittenText === false) {
      return NextResponse.json({ error: "No handwritten text found in the photos." }, { status: 422 });
    }
    const illegible = typeof result.illegible === "number" ? result.illegible : (text.match(/\[\?\]/g) ?? []).length;

    return NextResponse.json({ text, illegible });
  } catch (err) {
    console.error("Writing transcribe error:", err);
    return NextResponse.json({ error: "Failed to transcribe" }, { status: 500 });
  }
}
