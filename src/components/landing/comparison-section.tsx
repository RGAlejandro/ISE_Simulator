"use client";

import { useT } from "@/components/i18n/language-provider";

import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";

type Cell = true | false | "partial" | string;
// `feature` is a key of lp.compare in the dictionaries.
const ROWS: { feature: string; us: Cell; pdf: Cell; academy: Cell }[] = [
  { feature: "oral", us: true, pdf: false, academy: "€€€" },
  { feature: "feedback", us: true, pdf: false, academy: false },
  { feature: "unlimited", us: true, pdf: "partial", academy: false },
  { feature: "skills", us: true, pdf: "partial", academy: true },
  { feature: "always", us: true, pdf: true, academy: false },
  { feature: "readiness", us: true, pdf: false, academy: false },
  { feature: "tutor", us: true, pdf: false, academy: false },
  { feature: "price", us: "€9.99", pdf: "free", academy: "€100+" },
];

function CellView({ v, highlight, freeLabel }: { v: Cell; highlight?: boolean; freeLabel?: string }) {
  if (v === true) return <Check className={`h-4 w-4 mx-auto ${highlight ? "text-brand" : "text-emerald-500"}`} />;
  if (v === false) return <X className="h-4 w-4 mx-auto text-zinc-300 dark:text-zinc-600" />;
  if (v === "partial") return <Minus className="h-4 w-4 mx-auto text-amber-400" />;
  return <span className={`text-xs font-semibold ${highlight ? "text-brand" : "text-zinc-500"}`}>{v === "free" ? freeLabel : v}</span>;
}

export function ComparisonSection() {
  const t = useT();
  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("lp.compare.titleA")} <span className="marker-underline italic text-brand">ISE Simulator</span>
          </h2>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">{t("lp.compare.subtitle")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {/* Header */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] text-center border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("lp.compare.colFeature")}</div>
            <div className="px-2 py-3 text-sm font-display font-semibold text-brand">{t("lp.compare.colUs")}</div>
            <div className="px-2 py-3 text-xs font-medium text-zinc-500">{t("lp.compare.colPdf")}</div>
            <div className="px-2 py-3 text-xs font-medium text-zinc-500">{t("lp.compare.colAcademy")}</div>
          </div>
          {ROWS.map((r, i) => (
            <div key={r.feature}
              className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center text-center ${i % 2 ? "bg-zinc-50/40 dark:bg-zinc-800/20" : ""}`}>
              <div className="text-left px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">{t(`lp.compare.${r.feature}`)}</div>
              <div className="px-2 py-3 bg-brand/5"><CellView v={r.us} highlight /></div>
              <div className="px-2 py-3"><CellView v={r.pdf} freeLabel={t("lp.compare.free")} /></div>
              <div className="px-2 py-3"><CellView v={r.academy} /></div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
