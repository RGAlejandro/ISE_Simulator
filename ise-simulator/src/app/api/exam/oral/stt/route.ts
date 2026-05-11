import { NextResponse } from "next/server";

// STT is now handled client-side via Web Speech Recognition API (free)
export async function POST() {
  return NextResponse.json(
    { error: "STT is handled client-side via Web Speech API" },
    { status: 410 }
  );
}
