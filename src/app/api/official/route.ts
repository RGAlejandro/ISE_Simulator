import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist } from "@/lib/user";
import { geminiGenerateChatJSONWithFiles } from "@/lib/gemini";
import { sanitizePaper } from "@/lib/official";
import { officialPaperPrompt } from "@/lib/prompts/official";
import { readUploads, requireProUser } from "@/lib/official-server";

/**
 * Step 1: read a blank official Trinity paper (PDF or photos), plus its
 * answer key if uploaded separately. Pro only.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireProUser();
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data", code: "files" }, { status: 400 });
    const paperFiles = form.getAll("paper").filter((f): f is File => f instanceof File);
    const keyFiles = form.getAll("key").filter((f): f is File => f instanceof File).slice(0, 1);

    const uploads = await readUploads([...paperFiles, ...keyFiles]);
    if ("error" in uploads) return NextResponse.json({ error: "Unsupported or too large files", code: "files" }, { status: 400 });
    if (!(await consumeAiAssist(user.id, true))) {
      return NextResponse.json({ error: "Daily limit for AI helpers reached. Try again tomorrow.", code: "limit" }, { status: 429 });
    }

    const hasKeyFile = keyFiles.length > 0;
    const raw = await geminiGenerateChatJSONWithFiles(officialPaperPrompt({ hasKeyFile }), "Read this exam paper.", uploads.parts, {
      temperature: 0.1,
      timeoutMs: 150_000,
    }).catch((err) => {
      console.error("[official] paper read error:", err);
      return null;
    });
    if (raw === null) return NextResponse.json({ error: "Couldn't read the paper", code: "read" }, { status: 502 });

    const content = sanitizePaper(raw, hasKeyFile);
    if (!content) return NextResponse.json({ error: "Not a Trinity ISE Reading & Writing paper", code: "notPaper" }, { status: 422 });

    const paper = await prisma.officialPaper.create({
      data: { userId: user.id, level: content.level, title: content.title, content: JSON.parse(JSON.stringify(content)) },
    });
    return NextResponse.json({ id: paper.id });
  } catch (err) {
    console.error("[official] create error:", err);
    return NextResponse.json({ error: "Failed to read the paper", code: "read" }, { status: 500 });
  }
}
