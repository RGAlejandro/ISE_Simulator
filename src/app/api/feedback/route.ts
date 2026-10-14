import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import type { FeedbackCategory } from "@prisma/client";

const VALID_CATEGORIES: FeedbackCategory[] = ["SUGGESTION", "BUG", "OTHER"];
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 5;
const MAX_USER_AGENT_LENGTH = 300;

// DB-backed rate limit: 5 submissions per IP per hour. Counts recent Feedback
// rows by ipHash (indexed), so it survives restarts and multiple instances.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "0.0.0.0";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const recentCount = await prisma.feedback.count({
      where: {
        ipHash,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { category, message } = body as { category?: unknown; message?: unknown };

    if (typeof category !== "string" || !VALID_CATEGORIES.includes(category as FeedbackCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (typeof message !== "string") {
      return NextResponse.json({ error: "Message must be a string" }, { status: 400 });
    }

    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be at least ${MIN_MESSAGE_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }

    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, MAX_USER_AGENT_LENGTH);

    await prisma.feedback.create({
      data: {
        category: category as FeedbackCategory,
        message: trimmed,
        userAgent: userAgent || null,
        ipHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving feedback:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}

// Admin-only listing.
export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ items });
}
