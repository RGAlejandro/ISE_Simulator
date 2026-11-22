"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Send, Loader2, MessageSquare, SpellCheck, BookOpen, Layers, GraduationCap,
  BarChart3, CalendarClock, Camera, Target, ImagePlus, X, RotateCcw, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/language-provider";
import { RichText } from "@/components/chat/rich-text";
import { PracticeAction, SetGoalAction, UsedDataChips, VocabListGroup } from "@/components/chat/tutor-actions";
import { downscaleImage } from "@/lib/image-resize";
import type { TutorAction, TutorDataKey } from "@/lib/tutor";

const MAX_PHOTOS = 5;

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: TutorAction[];
  usedData?: TutorDataKey[];
  /** Object URLs of the photos attached to a user message (display only). */
  photos?: string[];
}

interface Pending {
  file: File;
  url: string;
}

interface Props {
  isPro: boolean;
  firstName: string | null;
  /** Opened from "Create a list from photos": prefill the request and highlight the photo button. */
  startWithPhotos: boolean;
}

export function ChatClient({ isPro, firstName, startWithPhotos }: Props) {
  const { t, dict, locale } = useI18n();
  const c = dict.chat;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(startWithPhotos ? c.suggestionsPro.photos.prompt : "");
  const [photos, setPhotos] = useState<Pending[]>([]);
  const [loading, setLoading] = useState<null | "text" | "photos">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const started = messages.length > 0;
  const welcome = isPro
    ? t("chat.welcomePro", { name: firstName ? `, ${firstName}` : "" })
    : c.welcomeFree;

  useEffect(() => {
    if (started) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, started]);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    if (incoming.length > room) setNotice(t("chat.tooManyPhotos", { n: MAX_PHOTOS }));
    else setNotice(null);
    setPhotos((prev) => [...prev, ...incoming.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  }

  function newChat() {
    setMessages([]);
    setNotice(null);
    setInput("");
  }

  async function send(raw: string) {
    const attached = photos;
    const text = raw.trim() || (attached.length > 0 ? c.suggestionsPro.photos.prompt : "");
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, photos: attached.map((p) => p.url) };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPhotos([]);
    setNotice(null);
    setLoading(attached.length > 0 ? "photos" : "text");

    const history = next.map((m) => ({ role: m.role, content: m.content }));
    try {
      let res: Response;
      if (attached.length > 0) {
        const form = new FormData();
        form.set("messages", JSON.stringify(history));
        form.set("locale", locale);
        const files = await Promise.all(attached.map((p) => downscaleImage(p.file)));
        for (const f of files) form.append("photos", f);
        res = await fetch("/api/chat", { method: "POST", body: form });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, locale }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Server faults get the translated generic message; 4xx explain themselves (limits, photo size).
        const content = res.status < 500 && typeof data.error === "string" ? data.error : c.errors.generic;
        setMessages((prev) => [...prev, { role: "assistant", content }]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: typeof data.message === "string" && data.message ? data.message : "",
          actions: Array.isArray(data.actions) ? data.actions : [],
          usedData: Array.isArray(data.usedData) ? data.usedData : [],
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: c.errors.network }]);
    } finally {
      setLoading(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const freeSuggestions = [
    { icon: BookOpen, ...c.suggestionsFree.grammar },
    { icon: SpellCheck, ...c.suggestionsFree.correct },
    { icon: Layers, ...c.suggestionsFree.vocab },
    { icon: GraduationCap, ...c.suggestionsFree.exam },
  ];
  const proSuggestions = [
    { icon: BarChart3, ...c.suggestionsPro.analyse, photos: false },
    { icon: CalendarClock, ...c.suggestionsPro.examSoon, photos: false },
    { icon: Camera, ...c.suggestionsPro.photos, photos: true },
    { icon: Target, ...c.suggestionsPro.today, photos: false },
  ];

  function pickSuggestion(s: { prompt: string; photos?: boolean }) {
    if (s.photos) {
      setInput(s.prompt);
      fileRef.current?.click();
      return;
    }
    send(s.prompt);
  }

  return (
    <div className="flex flex-col bg-paper" style={{ minHeight: "calc(100dvh - 4rem)" }}>
      {/* Header */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            {isPro ? <Sparkles className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isPro ? c.header.pro : c.header.free}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{isPro ? c.header.proSub : c.header.freeSub}</p>
          </div>
          {started && (
            <Button variant="ghost" size="sm" onClick={newChat} className="gap-1.5 shrink-0">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{c.newChat}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!started ? (
          <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 sm:px-6 py-12 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="relative mb-6"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-lg shadow-brand/20"
              >
                {isPro ? <Sparkles className="h-9 w-9" /> : <MessageSquare className="h-9 w-9" />}
              </motion.div>
              <motion.span
                animate={{ scale: [1, 1.25, 1], rotate: [0, 12, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-2 -right-2 text-amber-400"
              >
                <Sparkles className="h-6 w-6 fill-amber-400" />
              </motion.span>
            </motion.div>

            <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              <span className="marker-underline italic">{isPro ? c.heroPro.title : c.heroFree.title}</span>
            </h2>
            <p className="mt-3 max-w-md text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {isPro ? c.heroPro.body : c.heroFree.body}
            </p>

            <ol className="mt-8 w-full divide-y divide-rule border-y border-rule text-left">
              {(isPro ? proSuggestions : freeSuggestions).map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="group flex w-full items-start gap-4 py-3.5 text-left"
                  >
                    <span className="w-5 shrink-0 pt-0.5 font-display text-lg font-semibold text-ink-soft/60 tabular-nums">{i + 1}</span>
                    <s.icon className={cn("mt-1 h-4 w-4 shrink-0 text-ink-soft", startWithPhotos && "photos" in s && s.photos === true && "text-pen")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2">{s.title}</span>
                      <span className="block text-sm text-ink-soft leading-snug">{s.prompt}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {!isPro && (
              <Link
                href="/pricing"
                className="mt-6 flex w-full items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-left hover:border-amber-400 transition-colors"
              >
                <Crown className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.proCard.title}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">{c.proCard.body}</p>
                </div>
                <span className="shrink-0 self-center text-xs font-semibold text-amber-700 dark:text-amber-400">{c.proCard.cta} →</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
            <Bubble role="assistant"><RichText text={welcome} /></Bubble>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {m.role === "user" ? (
                    <Bubble role="user">
                      {m.photos && m.photos.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {m.photos.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-white/30" />
                          ))}
                        </div>
                      )}
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </Bubble>
                  ) : (
                    <div className="space-y-2">
                      {m.content && <Bubble role="assistant"><RichText text={m.content} /></Bubble>}
                      {(m.actions?.length || m.usedData?.length) ? (
                        <div className="ml-9.5 space-y-2.5">
                          {m.actions?.some((a) => a.type === "create_vocab_list") && (
                            <VocabListGroup actions={m.actions.filter((a) => a.type === "create_vocab_list")} />
                          )}
                          {m.actions?.map((a, ai) => (a.type === "set_goal" ? <SetGoalAction key={ai} action={a} /> : null))}
                          {m.actions?.some((a) => a.type === "practice") && (
                            <div className="flex flex-wrap gap-2">
                              {m.actions.map((a, ai) => (a.type === "practice" ? <PracticeAction key={ai} action={a} /> : null))}
                            </div>
                          )}
                          {m.usedData && <UsedDataChips keys={m.usedData} />}
                        </div>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start items-center gap-2.5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 shadow-sm flex items-center gap-2">
                  <span className="inline-flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                  {isPro && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {loading === "photos" ? c.readingPhotos : c.thinking}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 space-y-2">
          {(photos.length > 0 || notice) && (
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-14 w-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={c.removePhoto}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length > 0 && <span className="text-xs text-zinc-500">{t("chat.photosHint", { n: MAX_PHOTOS })}</span>}
              {notice && <span className="text-xs text-red-600 dark:text-red-400">{notice}</span>}
            </div>
          )}
          <div className="flex items-end gap-2">
            {isPro && (
              <>
                <input
                  ref={fileRef}
                  id="chat-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addPhotos(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={!!loading || photos.length >= MAX_PHOTOS}
                  className={cn("shrink-0 h-10 w-10 p-0", startWithPhotos && photos.length === 0 && !started && "border-brand ring-2 ring-brand/25")}
                  aria-label={c.attach}
                  title={c.attach}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              </>
            )}
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isPro ? c.placeholderPro : c.placeholderFree}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand/40 max-h-40 overflow-y-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <Button
              onClick={() => send(input)}
              disabled={!!loading || (!input.trim() && photos.length === 0)}
              className="shrink-0 h-10 w-10 p-0 bg-brand text-brand-foreground hover:opacity-90"
              aria-label={c.send}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      {role === "assistant" && (
        <div className="mr-2.5 mt-0.5 h-7 w-7 shrink-0 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          role === "user"
            ? "bg-brand text-brand-foreground rounded-br-sm"
            : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm shadow-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}
