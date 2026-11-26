import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist } from "@/lib/user";
import { geminiGenerateChatJSONWithFiles } from "@/lib/gemini";
import { sanitizeAnswers, type OfficialPaperContent } from "@/lib/official";
import { officialAnswersPrompt } from "@/lib/prompts/official";
import { readUploads, requireProUser } from "@/lib/official-server";

/** Step 2: transcribe the candidate's answers word for word (mistakes kept). Nothing is marked yet. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProUser();
    if ("error" in auth) return auth.error;
    const { user } = auth;
    const { id } = await params;

    const paper = await prisma.officialPaper.findUnique({ where: { id } });
    if (!paper || paper.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.status === "MARKED") return NextResponse.json({ error: "Already marked" }, { status: 409 });

    const form = await req.formData().catch(() => null);
    const files = form ? form.getAll("files").filter((f): f is File => f instanceof File) : [];
    const uploads = await readUploads(files);
    if ("error" in uploads) return NextResponse.json({ error: "Unsupported or too large files", code: "files" }, { status: 400 });
    if (!(await consumeAiAssist(user.id, true))) {
      return NextResponse.json({ error: "Daily limit for AI helpers reached. Try again tomorrow.", code: "limit" }, { status: 429 });
    }

    const content = paper.content as unknown as OfficialPaperContent;
    const raw = await geminiGenerateChatJSONWithFiles(officialAnswersPrompt(content), "Transcribe the candidate's answers.", uploads.parts, {
      temperature: 0,
      timeoutMs: 120_000,
    }).catch((err) => {
      console.error("[official] transcription error:", err);
      return null;
    });
    if (raw === null) return NextResponse.json({ error: "Couldn't read the answers", code: "read" }, { status: 502 });

    const answers = sanitizeAnswers(raw, content);
    await prisma.officialPaper.update({
      where: { id },
      data: { answers: JSON.parse(JSON.stringify(answers)), status: "TRANSCRIBED" },
    });
    return NextResponse.json({ answers });
  } catch (err) {
    console.error("[official] transcribe error:", err);
    return NextResponse.json({ error: "Failed to read the answers", code: "read" }, { status: 500 });
  }
}
