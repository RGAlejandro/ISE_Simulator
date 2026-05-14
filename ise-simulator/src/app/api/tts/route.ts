import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const ttsCache = new Map<string, ArrayBuffer>();

const audioHeaders = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "private, max-age=3600",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const trimmed = text.trim().slice(0, 1000);

  const cached = ttsCache.get(trimmed);
  if (cached) {
    return new Response(cached, { headers: audioHeaders });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      "en-GB-RyanNeural",
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

    if (ttsCache.size > 200) ttsCache.clear();
    ttsCache.set(trimmed, arrayBuffer);

    return new Response(arrayBuffer, { headers: audioHeaders });
  } catch (err) {
    console.error("[tts] edge error:", err);
    return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
  }
}
