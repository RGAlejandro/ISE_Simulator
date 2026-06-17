"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, AlertCircle, Send, Lightbulb, Bug, MessageCircle } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

const MAX_LENGTH = 2000;
const MIN_LENGTH = 5;

type Category = "SUGGESTION" | "BUG" | "OTHER";

const CATEGORIES: { value: Category; icon: typeof Lightbulb; key: string }[] = [
  { value: "SUGGESTION", icon: Lightbulb,     key: "landing.feedback.categorySuggestion" },
  { value: "BUG",        icon: Bug,           key: "landing.feedback.categoryBug" },
  { value: "OTHER",      icon: MessageCircle, key: "landing.feedback.categoryOther" },
];

export function FeedbackSection() {
  const t = useT();
  const [category, setCategory] = useState<Category>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string>("landing.feedback.errorMessage");

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;
  const disabled = status === "submitting" || trimmed.length < MIN_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: trimmed }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage("");
        setCategory("SUGGESTION");
        return;
      }

      if (res.status === 429) {
        setErrorKey("landing.feedback.errorRateLimit");
      } else if (res.status === 400) {
        setErrorKey("landing.feedback.errorTooShort");
      } else {
        setErrorKey("landing.feedback.errorMessage");
      }
      setStatus("error");
    } catch {
      setErrorKey("landing.feedback.errorMessage");
      setStatus("error");
    }
  }

  return (
    <section
      id="feedback"
      className="py-14 sm:py-20 lg:py-24 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
            <MessageSquare className="h-4 w-4" />
            {t("landing.feedback.title")}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {t("landing.feedback.title")}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            {t("landing.feedback.subtitle")}
          </p>
        </motion.div>

        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400 mb-3" />
            <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
              {t("landing.feedback.successTitle")}
            </h3>
            <p className="mt-2 text-emerald-700 dark:text-emerald-300">
              {t("landing.feedback.successBody")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={() => setStatus("idle")}
            >
              {t("landing.feedback.submit")}
            </Button>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm"
          >
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                {t("landing.feedback.categoryLabel")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(({ value, icon: Icon, key }) => {
                  const active = category === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                        active
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{t(key)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-2">
              <label
                htmlFor="feedback-message"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t("landing.feedback.messageLabel")}
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                maxLength={MAX_LENGTH}
                rows={6}
                placeholder={t("landing.feedback.messagePlaceholder")}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              <span>
                {tooShort ? t("landing.feedback.errorTooShort") : " "}
              </span>
              <span className="tabular-nums">
                {MAX_LENGTH - message.length} {t("landing.feedback.charsRemaining")}
              </span>
            </div>

            {status === "error" && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{t(errorKey)}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={disabled}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              {status === "submitting" ? (
                t("landing.feedback.sending")
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("landing.feedback.submit")}
                </>
              )}
            </Button>
          </motion.form>
        )}
      </div>
    </section>
  );
}
