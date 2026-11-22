import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat, generateChatJSON } from "@/lib/ai-provider";
import { geminiGenerateChatJSONWithFiles } from "@/lib/gemini";
import { isProUser, incrementUsage, consumeAiAssist } from "@/lib/user";
import { FREE_CHAT_DAILY_LIMIT } from "@/lib/constants";
import { buildTutorSnapshot } from "@/lib/tutor-context";
import { buildTutorConversation, getTutorSystemPrompt } from "@/lib/prompts/tutor";
import { sanitizeTutorResponse, type TutorAction } from "@/lib/tutor";
import { extractPhotoLists, photoListActions, photoListSummary, sanitizePhotoListMode, unreadableNote } from "@/lib/photo-lists";

// Defensive caps on the prompt we build from client-provided history
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

// Photos for the Pro tutor (study material: flashcards, notes, textbook pages)
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PHOTOS = 5;

/** Reply when the tutor's own answer failed but the photo lists are ready. */
const LISTS_READY: Record<string, string> = {
  es: "He leído tus fotos. Revisa las listas de abajo y créalas con un clic.",
  en: "I've read your photos. Check the lists below and create them with one click.",
  fr: "J'ai lu vos photos. Vérifiez les listes ci-dessous et créez-les en un clic.",
};
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** Gemini's inline-data request cap is ~20 MB. */
const MAX_PHOTOS_TOTAL = 18 * 1024 * 1024;

const SYSTEM_PROMPT = `You are "ISE Assistant", a friendly AI English tutor embedded in ISE Simulator — a web app that helps students learn English and prepare for the Trinity College London ISE (Integrated Skills in English) exams.

YOUR SCOPE — you help with ANYTHING related to learning English, including:
- General English questions: grammar, vocabulary, phrasal verbs, idioms, collocations, pronunciation, spelling, punctuation, register/formality
- Word meanings, differences between similar words, synonyms/antonyms, example sentences
- Translations between English and the user's language, and explaining why
- Correcting and improving sentences or short texts (mind the plan limits below)
- Writing help: structure, connectors, paraphrasing, style
- The Trinity ISE exam: structure, levels, tasks and scoring (ISE Foundation/A2, ISE I/B1, ISE II/B2, ISE III/C1, ISE IV/C2), written and oral tasks, assessment criteria
- How to use ISE Simulator (features, plans, how to practise)
- Study tips and strategies to improve English and pass the exam

RESTRICTIONS:
- Stay on topic: you only help with English language learning and the ISE exam. If asked about something clearly unrelated (politics, coding, recipes, medical/legal advice, etc.), politely redirect to what you can help with.
- Do NOT make up exam content, scores, or official Trinity policies you are not sure about. Say "I'm not sure — please check the official Trinity website."

PLAN-BASED RESTRICTIONS (critical — always follow these):
- FREE users: give general exam advice, study tips, and feature explanations. Do NOT provide detailed personalised essay feedback, do NOT offer to correct their writing at length, do NOT simulate a full exam session through chat. For those features, tell them to use the app's exam modules (which handle gating properly).
- PRO users: you can give richer, more detailed guidance. You can give more thorough feedback on short writing samples they paste (up to ~100 words). Still don't perform full exam simulations through chat.
- If a free user asks for something that requires Pro, tell them politely: "That level of detail is available to Pro users — you can upgrade at /pricing."

TONE: Friendly, encouraging, clear. You can respond in English or Spanish depending on what language the user writes in.

USER CONTEXT (if provided below): Use it to personalise your answers.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is ChatMessage => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

/** JSON for text-only messages; multipart when the Pro tutor gets photos. */
async function readRequest(req: NextRequest): Promise<{ messages: ChatMessage[]; photos: File[]; locale: string } | null> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = cleanHistory(JSON.parse(String(form.get("messages") ?? "[]")));
      const photos = form.getAll("photos").filter((f): f is File => f instanceof File);
      return { messages, photos, locale: String(form.get("locale") ?? "es") };
    }
    const body = await req.json();
    return { messages: cleanHistory(body?.messages), photos: [], locale: typeof body?.locale === "string" ? body.locale : "es" };
  } catch {
    return null;
  }
}

function photoError(photos: File[]): string | null {
  if (photos.length > MAX_PHOTOS) return `Up to ${MAX_PHOTOS} photos per message.`;
  let total = 0;
  for (const p of photos) {
    if (!PHOTO_TYPES.includes(p.type)) return "Unsupported file type. Use JPEG, PNG, WebP or HEIC photos.";
    if (p.size > MAX_PHOTO_BYTES) return "Photo too large (max 8 MB each).";
    total += p.size;
  }
  return total > MAX_PHOTOS_TOTAL ? "Photos too large in total." : null;
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = await readRequest(req);
  if (!input || input.messages.length === 0 || input.messages[input.messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }
  const { messages, photos, locale } = input;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  }).catch(() => null);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isPro = isProUser(user);

  // ── Pro: personal tutor with the learner's own data (and optional photos) ──
  if (isPro) {
    if (photos.length > 0) {
      const err = photoError(photos);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      if (!(await consumeAiAssist(user.id, true))) {
        return NextResponse.json({ error: "Daily limit for AI helpers reached. Try again tomorrow." }, { status: 429 });
      }
    }
    try {
      const snapshot = await buildTutorSnapshot(user.id);
      const system = getTutorSystemPrompt(snapshot, { locale, photoCount: photos.length });
      const conversation = buildTutorConversation(messages, photos.length);

      if (photos.length === 0) {
        const tutor = sanitizeTutorResponse(await generateChatJSON(system, conversation, { temperature: 0.5, prefer: "gemini" }));
        if (!tutor.reply && tutor.actions.length === 0) {
          return NextResponse.json({ error: "Failed to generate response" }, { status: 502 });
        }
        return NextResponse.json({ message: tutor.reply, actions: tutor.actions, usedData: tutor.usedData });
      }

      // Photos: each one is read into its own word list, in parallel. Then the tutor
      // replies from what was read (text only, fast) and just picks the grouping.
      // Photos with no vocabulary on them (an essay, an exercise) go to the tutor as images.
      const files = await Promise.all(
        photos.map(async (p) => ({ data: Buffer.from(await p.arrayBuffer()).toString("base64"), mimeType: p.type })),
      );
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const lists = await extractPhotoLists(files, { instruction: lastUser, level: snapshot.goal.level });
      const raw = lists.some((l) => l.words.length > 0)
        ? await generateChatJSON(
            getTutorSystemPrompt(snapshot, { locale, photoCount: photos.length, photoSummary: photoListSummary(lists) }),
            conversation,
            { temperature: 0.4 },
          ).catch((err) => {
            console.error("Tutor photo reply error:", err);
            return null;
          })
        : await geminiGenerateChatJSONWithFiles(system, conversation, files, { temperature: 0.3, timeoutMs: 30_000 }).catch((err) => {
            console.error("Tutor photo reply error:", err);
            return null;
          });
      const tutor = sanitizeTutorResponse(raw);
      const listActions = photoListActions(lists, sanitizePhotoListMode((raw as { photoLists?: unknown } | null)?.photoLists), locale);
      const actions: TutorAction[] = [...listActions, ...tutor.actions.filter((a) => a.type !== "create_vocab_list")];
      // The tutor already explains unread photos (they're in its context); add the note only if it didn't answer.
      const reply = tutor.reply
        || [listActions.length > 0 ? LISTS_READY[locale] ?? LISTS_READY.es : "", unreadableNote(lists, locale)].filter(Boolean).join("\n\n");
      if (!reply && actions.length === 0) {
        return NextResponse.json({ error: "Failed to generate response" }, { status: 502 });
      }
      const usedData = tutor.usedData.includes("photos") ? tutor.usedData : [...tutor.usedData, "photos" as const];
      return NextResponse.json({ message: reply, actions, usedData });
    } catch (err) {
      console.error("Tutor chat error:", err);
      return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }
  }

  // ── Free: general English assistant (unchanged), no access to personal data ──
  if (photos.length > 0) {
    return NextResponse.json({ error: "Photos are part of the Pro personal tutor.", upsell: true }, { status: 403 });
  }

  // Rate-limit free users server-side: persistent daily counter, not client-sent history
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  if ((usage?.chatCount ?? 0) >= FREE_CHAT_DAILY_LIMIT) {
    return NextResponse.json({
      message: `Has alcanzado el límite de ${FREE_CHAT_DAILY_LIMIT} mensajes al día para usuarios gratuitos. Actualiza a Pro en /pricing para conversaciones ilimitadas.`,
    });
  }

  const userContextBlock = `\n\nUSER CONTEXT:\n- Name: ${user.name ?? "unknown"}\n- Plan: Free (limited daily exams; chat limited to ${FREE_CHAT_DAILY_LIMIT} messages per day)\n- Exam level preference: not stored (ask them if relevant)`;
  const fullPrompt = `${SYSTEM_PROMPT}${userContextBlock}`;

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  try {
    const text = await generateChat(fullPrompt, conversationText, {
      temperature: 0.7,
      maxTokens: 512,
    });
    await incrementUsage(user.id, "chat");
    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
