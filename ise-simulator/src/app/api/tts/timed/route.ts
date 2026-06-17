import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 5000;
const ALLOWED_VOICES = ["en-GB-RyanNeural", "en-GB-SoniaNeural", "en-GB-LibbyNeural"];
const DEFAULT_VOICE = "en-GB-SoniaNeural";

interface TimedWord {
  text: string;
  /** seconds from audio start */
  start: number;
  end: number;
}

// Cache the full timed payload (audio + words) per voice+text.
const cache = new Map<string, { audioBase64: string; words: TimedWord[] }>();

/** Extract all top-level JSON objects from concatenated metadata frames. */
function parseMetadataObjects(raw: string): unknown[] {
  const objects: unknown[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          objects.push(JSON.parse(raw.slice(start, i + 1)));
        } catch {
          // ignore malformed frame
        }
        start = -1;
      }
    }
  }
  return objects;
}

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

  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    });

    const audioChunks: Buffer[] = [];
    const metaParts: string[] = [];

    const { audioStream, metadataStream } = tts.toStream(trimmed);
    if (metadataStream) {
      metadataStream.on("data", (c: Buffer) => metaParts.push(c.toString()));
    }
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (c: Buffer) => audioChunks.push(c));
      // Give the metadata stream a beat to flush after the audio ends.
      audioStream.on("end", () => setTimeout(resolve, 200));
      audioStream.on("error", reject);
    });

    const words: TimedWord[] = [];
    for (const obj of parseMetadataObjects(metaParts.join(""))) {
      const entries = (obj as { Metadata?: unknown[] }).Metadata ?? [];
      for (const entry of entries) {
        const e = entry as {
          Type?: string;
          Data?: { Offset?: number; Duration?: number; text?: { Text?: string } };
        };
        if (e.Type !== "WordBoundary" || !e.Data) continue;
        const offset = e.Data.Offset ?? 0;
        const duration = e.Data.Duration ?? 0;
        const word = e.Data.text?.Text ?? "";
        if (!word) continue;
        // Edge units are 100-nanosecond ticks → seconds.
        words.push({ text: word, start: offset / 1e7, end: (offset + duration) / 1e7 });
      }
    }

    const payload = {
      audioBase64: Buffer.concat(audioChunks).toString("base64"),
      words,
    };

    if (cache.size > 50) cache.clear();
    cache.set(cacheKey, payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[tts/timed] error:", err);
    return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
  }
}
