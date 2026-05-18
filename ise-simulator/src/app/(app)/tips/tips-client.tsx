"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen, PenTool, Mic, Target, Lightbulb, Clock,
  AlertTriangle, Sparkles, ArrowRight, Quote, GraduationCap,
  Layers, FileText, MessagesSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type Category = "reading" | "writing" | "oral" | "strategy";
type SectionKey = "readingTasks" | "readingIntoWriting" | "extendedWriting" | "oralTopic" | "oralConversation" | "examStrategy";

interface SectionConfig {
  slug: string;
  key: SectionKey;
  category: Category;
  icon: typeof BookOpen;
  ctaHref: string;
  minutes?: number;
}

const SECTION_CONFIG: SectionConfig[] = [
  { slug: "reading-tasks",        key: "readingTasks",       category: "reading",  icon: PenTool,        ctaHref: "/practice",  minutes: 50 },
  { slug: "reading-into-writing", key: "readingIntoWriting", category: "writing",  icon: BookOpen,       ctaHref: "/practice",  minutes: 35 },
  { slug: "extended-writing",     key: "extendedWriting",    category: "writing",  icon: Target,         ctaHref: "/practice",  minutes: 45 },
  { slug: "oral-topic",           key: "oralTopic",          category: "oral",     icon: Mic,            ctaHref: "/practice",  minutes: 6  },
  { slug: "oral-conversation",    key: "oralConversation",   category: "oral",     icon: MessagesSquare, ctaHref: "/practice",  minutes: 6  },
  { slug: "exam-strategy",        key: "examStrategy",       category: "strategy", icon: Clock,          ctaHref: "/dashboard"             },
];

const CATEGORY_STYLES: Record<Category, {
  chip: string;
  ring: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  accent: string;
  gradient: string;
}> = {
  reading: {
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ring: "ring-blue-200/60 dark:ring-blue-900/50",
    bg: "from-blue-50 to-transparent dark:from-blue-950/40",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-300",
    accent: "text-blue-600 dark:text-blue-300",
    gradient: "from-blue-500 to-indigo-500",
  },
  writing: {
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ring: "ring-emerald-200/60 dark:ring-emerald-900/50",
    bg: "from-emerald-50 to-transparent dark:from-emerald-950/40",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    accent: "text-emerald-600 dark:text-emerald-300",
    gradient: "from-emerald-500 to-teal-500",
  },
  oral: {
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    ring: "ring-rose-200/60 dark:ring-rose-900/50",
    bg: "from-rose-50 to-transparent dark:from-rose-950/40",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconColor: "text-rose-600 dark:text-rose-300",
    accent: "text-rose-600 dark:text-rose-300",
    gradient: "from-rose-500 to-pink-500",
  },
  strategy: {
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ring: "ring-amber-200/60 dark:ring-amber-900/50",
    bg: "from-amber-50 to-transparent dark:from-amber-950/40",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-300",
    accent: "text-amber-600 dark:text-amber-300",
    gradient: "from-amber-500 to-orange-500",
  },
};

const TIME_ALLOCATION: { en: string; es: string; minutes: number; category: Category }[] = [
  { en: "Long Reading",         es: "Long Reading",          minutes: 25, category: "reading" },
  { en: "Multi-Text Reading",   es: "Multi-Text Reading",    minutes: 25, category: "reading" },
  { en: "Reading into Writing", es: "Reading into Writing",  minutes: 35, category: "writing" },
  { en: "Extended Writing",     es: "Extended Writing",      minutes: 45, category: "writing" },
];

export function TipsClient() {
  const { t, dict, locale } = useI18n();
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [activeSlug, setActiveSlug] = useState<string>(SECTION_CONFIG[0].slug);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const filtered = useMemo(
    () => (filter === "all" ? SECTION_CONFIG : SECTION_CONFIG.filter(s => s.category === filter)),
    [filter],
  );

  // Scroll-spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSlug(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [filter]);

  const totalTips = SECTION_CONFIG.reduce((a, s) => a + dict.tips.section[s.key].tips.length, 0);
  const maxTime = Math.max(...TIME_ALLOCATION.map(ta => ta.minutes));

  const counts: Record<Category | "all", number> = {
    all: SECTION_CONFIG.length,
    reading:  SECTION_CONFIG.filter(s => s.category === "reading").length,
    writing:  SECTION_CONFIG.filter(s => s.category === "writing").length,
    oral:     SECTION_CONFIG.filter(s => s.category === "oral").length,
    strategy: SECTION_CONFIG.filter(s => s.category === "strategy").length,
  };

  const categoryLabel = (c: Category) => t(`tips.filter.${c}`);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-rose-50 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-rose-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-rose-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-8">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-3 sm:mb-4 backdrop-blur bg-white/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700">
                <GraduationCap className="h-3 w-3 mr-1" />
                {t("tips.badge")}
              </Badge>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t("tips.title")}
              </h1>
              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t("tips.description")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
              <HeroStat label={t("tips.stats.sections")} value={SECTION_CONFIG.length} icon={<Layers className="h-4 w-4" />} />
              <HeroStat label={t("tips.stats.strategies")} value={totalTips} icon={<Sparkles className="h-4 w-4" />} />
              <HeroStat label={t("tips.stats.modules")} value={4} icon={<FileText className="h-4 w-4" />} />
            </div>
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <div className="sticky top-16 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1 shrink-0">{t("tips.filter.label")}</span>
          <div className="flex items-center gap-2 flex-nowrap">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={`${t("tips.filter.all")} · ${counts.all}`} />
            {(Object.keys(CATEGORY_STYLES) as Category[]).map(cat => (
              <FilterPill
                key={cat}
                active={filter === cat}
                onClick={() => setFilter(cat)}
                label={`${categoryLabel(cat)} · ${counts[cat]}`}
                chipClass={CATEGORY_STYLES[cat].chip}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">

          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-36">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                {t("tips.toc")}
              </p>
              <ul className="space-y-1 border-l border-zinc-200 dark:border-zinc-800">
                {filtered.map(s => {
                  const active = activeSlug === s.slug;
                  const c = CATEGORY_STYLES[s.category];
                  return (
                    <li key={s.slug}>
                      <a
                        href={`#${s.slug}`}
                        className={cn(
                          "block -ml-px border-l-2 pl-4 py-2 text-sm transition-colors",
                          active
                            ? cn("border-current font-medium", c.accent)
                            : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        )}
                      >
                        {dict.tips.section[s.key].title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Main column */}
          <div className="space-y-10">
            {filtered.map((s) => {
              const c = CATEGORY_STYLES[s.category];
              const Icon = s.icon;
              const sd = dict.tips.section[s.key];
              return (
                <section
                  key={s.slug}
                  id={s.slug}
                  ref={(el) => { sectionRefs.current[s.slug] = el; }}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 ring-1 scroll-mt-32",
                    c.ring,
                  )}
                >
                  <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", c.gradient)} />
                  <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", c.bg)} />

                  <div className="relative p-5 sm:p-6 lg:p-8">
                    {/* Header */}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={cn("flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl", c.iconBg)}>
                        <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", c.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Badge className={cn("border-0", c.chip)}>{categoryLabel(s.category)}</Badge>
                          {s.minutes !== undefined && (
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="h-3 w-3 mr-1" />
                              ~{s.minutes} min
                            </Badge>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{sd.title}</h2>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{sd.intro}</p>
                      </div>
                    </div>

                    {/* Tips grid */}
                    <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                      {sd.tips.map((tip, i) => (
                        <li
                          key={i}
                          className="group flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/60 p-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                        >
                          <span className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                            c.iconBg, c.iconColor,
                          )}>
                            {i + 1}
                          </span>
                          <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">{tip}</p>
                        </li>
                      ))}
                    </ol>

                    {/* Callouts */}
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t("tips.callout.mistake")}</span>
                        </div>
                        <p className="text-sm text-amber-900/90 dark:text-amber-100/80 leading-relaxed">{sd.mistake}</p>
                      </div>
                      <div className="rounded-xl border border-violet-200 bg-violet-50/60 dark:border-violet-900/50 dark:bg-violet-950/30 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">{t("tips.callout.proTip")}</span>
                        </div>
                        <p className="text-sm text-violet-900/90 dark:text-violet-100/80 leading-relaxed">{sd.proTip}</p>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t border-zinc-200/70 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("tips.callout.applyLine")}
                      </span>
                      <Link href={s.ctaHref} className="shrink-0">
                        <Button size="sm" variant="outline" className="w-full sm:w-auto gap-1.5 group">
                          {sd.cta}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Time allocation */}
            {filter === "all" && (
              <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 sm:p-6 lg:p-8">
                <div className="flex items-start gap-3 sm:gap-4 mb-6">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("tips.timeAllocation.title")}</h2>
                    <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{t("tips.timeAllocation.subtitle")}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {TIME_ALLOCATION.map((ta) => {
                    const pct = (ta.minutes / maxTime) * 100;
                    const c = CATEGORY_STYLES[ta.category];
                    const label = locale === "es" ? ta.es : ta.en;
                    return (
                      <div key={ta.en}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-zinc-700 dark:text-zinc-200">{label}</span>
                          <span className={cn("font-semibold tabular-nums", c.accent)}>{ta.minutes} min</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full bg-gradient-to-r", c.gradient)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/60 p-3">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {t("tips.timeAllocation.reminder", { min: 5 })}
                  </p>
                </div>
              </section>
            )}

            {/* Examiner quote */}
            {filter === "all" && (
              <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-zinc-900 via-zinc-800 to-blue-950 text-white p-6 sm:p-8 lg:p-10">
                <Quote className="absolute top-4 right-4 sm:top-6 sm:right-6 h-16 w-16 sm:h-20 sm:w-20 text-white/5" />
                <div className="relative max-w-2xl">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2 sm:mb-3">{t("tips.examiner.label")}</p>
                  <blockquote className="text-lg sm:text-xl lg:text-2xl font-medium leading-snug text-white/95">
                    &ldquo;{t("tips.examiner.quote")}&rdquo;
                  </blockquote>
                  <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-blue-200/80">{t("tips.examiner.source")}</p>
                </div>
              </section>
            )}

            {/* Bottom CTA */}
            <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 lg:p-10 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-transparent to-rose-50 dark:from-blue-950/30 dark:to-rose-950/20 pointer-events-none" />
              <div className="relative">
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("tips.bottom.title")}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 max-w-lg mx-auto">
                  {t("tips.bottom.body")}
                </p>
                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3">
                  <Link href="/practice">
                    <Button size="lg" className="w-full sm:w-auto gap-2">
                      {t("tips.bottom.fullExam")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/practice">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                      {t("tips.bottom.targeted")}
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800 backdrop-blur p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl lg:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function FilterPill({
  active, onClick, label, chipClass,
}: { active: boolean; onClick: () => void; label: string; chipClass?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
        active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-sm"
          : cn(
              "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
              chipClass && !active && "border-transparent",
              chipClass,
            ),
      )}
    >
      {label}
    </button>
  );
}
