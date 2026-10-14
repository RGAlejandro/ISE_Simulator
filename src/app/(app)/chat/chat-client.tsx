"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Send, Loader2, MessageSquare,
  SpellCheck, BookOpen, Layers, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy tu asistente de inglés.\n\nPregúntame lo que quieras sobre el inglés: gramática, vocabulario, phrasal verbs, pronunciación, diferencias entre palabras, traducciones, o consejos para el examen Trinity ISE. También puedo corregir frases y ayudarte a mejorar tu escritura.\n\n¿En qué te ayudo hoy? (Puedes escribir en español o inglés.)",
};

const SUGGESTIONS: { icon: typeof BookOpen; title: string; prompt: string }[] = [
  { icon: BookOpen, title: "Grammar", prompt: "What's the difference between 'make' and 'do'?" },
  { icon: SpellCheck, title: "Correct me", prompt: "Corrige esta frase: I have went to the store yesterday" },
  { icon: Layers, title: "Vocabulary", prompt: "Give me 5 C1 phrasal verbs with examples" },
  { icon: GraduationCap, title: "Exam tips", prompt: "How is the Trinity ISE III oral exam structured?" },
];

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const started = messages.length > 1;

  useEffect(() => {
    if (started) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, started]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message ?? "Sorry, I couldn't generate a response." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hubo un error al conectar. Por favor, inténtalo de nuevo." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col paper-bg" style={{ minHeight: "calc(100dvh - 4rem)" }}>
      {/* Header */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              English Chat
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ask anything about English or the Trinity ISE exam
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!started ? (
          /* ── Welcome hero (first load) ── */
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
                <MessageSquare className="h-9 w-9" />
              </motion.div>
              <motion.span
                animate={{ scale: [1, 1.25, 1], rotate: [0, 12, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-2 -right-2 text-amber-400"
              >
                <Sparkles className="h-6 w-6 fill-amber-400" />
              </motion.span>
            </motion.div>

            <motion.h2
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Tu <span className="marker-underline italic">asistente de inglés</span>
            </motion.h2>
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="mt-3 max-w-md text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed"
            >
              Gramática, vocabulario, pronunciación, traducciones, corrección de frases o
              consejos para el examen Trinity ISE. Pregunta en español o inglés.
            </motion.p>

            <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.title}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.28 + i * 0.07 }}
                  whileHover={{ y: -3 }}
                  onClick={() => send(s.prompt)}
                  className="group flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 backdrop-blur px-4 py-3 text-left transition-colors hover:border-brand dark:hover:border-brand"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/15">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-2">{s.prompt}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Conversation ── */
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <div className="mr-2.5 mt-0.5 h-7 w-7 shrink-0 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-brand text-brand-foreground rounded-br-sm"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm shadow-sm"
                    )}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start items-center gap-2.5"
              >
                <div className="h-7 w-7 shrink-0 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 shadow-sm">
                  <span className="inline-flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta lo que quieras sobre el inglés…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand/40 max-h-40 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <Button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="shrink-0 h-10 w-10 p-0 bg-brand text-brand-foreground hover:opacity-90"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
