import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { groqTranscribeAudio } from "@/lib/groq";

export const runtime = "nodejs";

// ~60s of webm/opus speech is well under 2 MB; cap generously.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

/**
 * Server-side speech-to-text via Groq Whisper. Browser records with
 * MediaRecorder and posts the blob here — works in every browser, unlike
 * the Web Speech API (Chrome/Edge only).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Transcription service not configured" }, { status: 503 });
    }

    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty recording" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Recording too long (max 10MB)" }, { status: 400 });
    }
    const baseType = (file.type || "").split(";")[0];
    if (baseType && !ALLOWED_TYPES.includes(baseType)) {
      return NextResponse.json({ error: `Unsupported audio type: ${baseType}` }, { status: 400 });
    }

    const text = (await groqTranscribeAudio(file)).trim();
    if (!text) {
      return NextResponse.json({ error: "Could not understand the recording" }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[oral-stt]", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
