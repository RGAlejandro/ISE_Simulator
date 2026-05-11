import { NextResponse } from "next/server";

// TTS is now handled client-side via Web Speech Synthesis API (free)
export async function POST() {
  return NextResponse.json(
    { error: "TTS is handled client-side via Web Speech API" },
    { status: 410 }
  );
}
