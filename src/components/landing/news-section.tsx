"use client";

import { motion } from "framer-motion";
import { Camera, Radio, Target, Users } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

// The four newest capabilities; `key` maps to lp.news.<key>T / <key>B in the dictionaries.
const ITEMS = [
  { key: "live", icon: Radio },
  { key: "tutor", icon: Camera },
  { key: "goal", icon: Target },
  { key: "teams", icon: Users },
] as const;

/** "What's new": the live examiner, the tutor, module goals and the teams panel. */
export function NewsSection() {
  const t = useT();
  return (
    <section id="new" className="scroll-mt-20 bg-paper py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{t("lp.news.eyebrow")}</p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
            <span className="marker-underline">{t("lp.news.title")}</span>
          </h2>
          <p className="mt-3 text-lg text-ink-soft">{t("lp.news.subtitle")}</p>
        </div>

        <ol className="mt-10 grid gap-x-12 border-t border-rule sm:grid-cols-2">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <motion.li
              key={key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex gap-5 border-b border-rule py-7"
            >
              <span className="w-6 shrink-0 font-display text-3xl font-semibold leading-none text-ink-soft/50 tabular-nums">{i + 1}</span>
              <div className="min-w-0 space-y-2">
                <h3 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink">
                  <Icon className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                  {t(`lp.news.${key}T`)}
                </h3>
                <p className="text-[15px] leading-relaxed text-ink-soft">{t(`lp.news.${key}B`)}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
