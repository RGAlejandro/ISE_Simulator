import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const ttsCache = new Map<string, ArrayBuffer>();

// Long-form content (listening passages, examiner turns) needs more than the
// old 1000-char cap — ISE III/IV passages run ~2500+ chars.
const MAX_TEXT_LENGTH = 5000;

const ALLOWED_VOICES = [
  "en-GB-RyanNeural",
  "en-GB-SoniaNeural",
  "en-GB-LibbyNeural",
] as const;
const DEFAULT_VOICE = "en-GB-RyanNeural";

const audioHeaders = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "private, max-age=3600",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, voice } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  const selectedVoice = ALLOWED_VOICES.includes(voice) ? (voice as string) : DEFAULT_VOICE;
  const cacheKey = `${selectedVoice}:${trimmed}`;

  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return new Response(cached, { headers: audioHeaders });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      selectedVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const { audioStream } = tts.toStream(trimmed);
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });

    const arrayBuffer = Buffer.concat(chunks).buffer;

    if (ttsCache.size > 100) ttsCache.clear();
    ttsCache.set(cacheKey, arrayBuffer);

    return new Response(arrayBuffer, { headers: audioHeaders });
  } catch (err) {
    console.error("[tts] edge error:", err);
    return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
  }
}
