"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Volume2, BookOpen, Loader2, PenTool, Mic,
  Sparkles, AlertCircle, GraduationCap,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n/language-provider";
import { EXAM_LEVELS, FREE_DAILY_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";
type SetupKind = "written" | "oral" | "listening";
type LoadingKind = SetupKind | null;

interface PracticeClientProps {
  isPro: boolean;
  writtenCount: number;
  oralCount: number;
  listeningCount: number;
  canTakeWritten: boolean;
  canTakeOral: boolean;
  canTakeListening: boolean;
}

const SETUP_STYLE: Record<SetupKind, {
  iconBg: string;
  iconColor: string;
  Icon: typeof PenTool;
  ctaColor: string;
}> = {
  written:   { iconBg: "bg-blue-100 dark:bg-blue-900/50",   iconColor: "text-blue-600 dark:text-blue-300",   Icon: PenTool, ctaColor: "bg-blue-600 hover:bg-blue-700" },
  oral:      { iconBg: "bg-rose-100 dark:bg-rose-900/50",   iconColor: "text-rose-600 dark:text-rose-300",   Icon: Mic,     ctaColor: "bg-rose-600 hover:bg-rose-700" },
  listening: { iconBg: "bg-purple-100 dark:bg-purple-900/50", iconColor: "text-purple-600 dark:text-purple-300", Icon: Volume2, ctaColor: "bg-purple-600 hover:bg-purple-700" },
};

export function PracticeClient({
  isPro, writtenCount, oralCount, listeningCount,
  canTakeWritten, canTakeOral, canTakeListening,
}: PracticeClientProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [setupKind, setSetupKind] = useState<SetupKind | null>(null);
  const [setupLevel, setSetupLevel] = useState<ExamLevel | "">("");
  const [oralTopic, setOralTopic] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);

  const openSetup = (kind: SetupKind) => {
    setError(null);
    if (kind === "written" && !canTakeWritten) {
      setError(t("practice.setup.errors.limitWritten"));
      return;
    }
    if (kind === "oral" && !canTakeOral) {
      setError(t("practice.setup.errors.limitOral"));
      return;
    }
    if (kind === "listening" && !canTakeListening) {
      setError(t("practice.setup.errors.limitListening"));
      return;
    }
    setSetupError(null);
    setSetupLevel("");
    if (kind !== "oral") setOralTopic("");
    setSetupKind(kind);
  };

  const submitSetup = async () => {
    if (!setupKind) return;
    if (!setupLevel) {
      setSetupError(t("practice.setup.errors.levelRequired"));
      return;
    }
    if (setupKind === "oral" && oralTopic.trim().length < 3) {
      setSetupError(t("practice.setup.errors.topicShort"));
      return;
    }

    const kind = setupKind;
    const level = setupLevel;
    const topic = oralTopic.trim();

    setSetupError(null);
    setSetupKind(null);
    setLoading(kind);

    try {
      if (kind === "written") {
        setGeneratingMessage(t("practice.loading.written"));
        const res = await fetch("/api/exam/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate exam");
        router.push(`/exam/written/${data.examId}`);
      } else if (kind === "oral") {
        setGeneratingMessage(t("practice.loading.oral"));
        const res = await fetch("/api/exam/oral/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, topic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start oral exam");
        router.push(`/exam/oral/${data.examId}`);
      } else {
        setGeneratingMessage(t("practice.loading.listening"));
        const res = await fetch("/api/listening/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate session");
        router.push(`/listening/${data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
      setGeneratingMessage(null);
    }
  };

  const usageLabel = (count: number, limit: number) =>
    isPro ? `${count} ${t("common.today")}` : `${count}/${limit} ${t("common.today")}`;

  const setupStyle = setupKind ? SETUP_STYLE[setupKind] : null;
  const SetupIcon = setupStyle?.Icon;

  const setupTitle = setupKind ? t(`practice.setup.${setupKind}Title`) : "";
  const setupDescription = setupKind ? t(`practice.setup.${setupKind}Description`) : "";
  const setupCta = setupKind ? t(`practice.setup.start${setupKind.charAt(0).toUpperCase() + setupKind.slice(1)}`) : "";

  return (
    <>
      {/* Setup modal */}
      <Dialog open={setupKind !== null} onOpenChange={(open) => { if (!open) { setSetupKind(null); setSetupError(null); } }}>
        <DialogContent>
          {setupStyle && SetupIcon && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", setupStyle.iconBg, setupStyle.iconColor)}>
                    <SetupIcon className="h-5 w-5" />
                  </div>
                  <DialogTitle>{setupTitle}</DialogTitle>
                </div>
                <DialogDescription>{setupDescription}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Level grid */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">
                    {t("practice.setup.chooseLevel")}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EXAM_LEVELS.map((l) => {
                      const active = setupLevel === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          onClick={() => { setSetupLevel(l.value as ExamLevel); if (setupError) setSetupError(null); }}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-left transition-all",
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                              : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
                          )}
                        >
                          <p className="text-sm font-semibold">{l.label}</p>
                          <p className={cn("text-[10px] uppercase tracking-wide", active ? "text-white/70 dark:text-zinc-900/70" : "text-zinc-500 dark:text-zinc-400")}>{l.cefr}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Oral topic */}
                {setupKind === "oral" && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">
                      {t("practice.setup.yourTopic")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("practice.setup.topicPlaceholder")}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      value={oralTopic}
                      onChange={(e) => { setOralTopic(e.target.value); if (setupError) setSetupError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") submitSetup(); }}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-400">{t("practice.setup.tryHint")}</span>
                      {["Climate change", "Social media", "Future of work", "Technology in education"].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setOralTopic(s)}
                          className="px-2 py-0.5 text-[11px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {setupError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {setupError}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSetupKind(null)}>{t("common.cancel")}</Button>
                <Button onClick={submitSetup} className={cn("gap-2", setupStyle.ctaColor)}>
                  <SetupIcon className="h-4 w-4" /> {setupCta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen loading overlay */}
      {generatingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-white dark:bg-zinc-900 p-10 shadow-2xl max-w-md mx-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-blue-200 dark:border-blue-800" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{t("practice.loading.title")}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{generatingMessage}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
                {t("practice.loading.hint")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-14 text-center">
          <Badge variant="outline" className="mb-3 sm:mb-4 backdrop-blur bg-white/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700">
            <Sparkles className="h-3 w-3 mr-1" />
            {t("practice.badge")}
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("practice.title")}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto px-2">
            {t("practice.description")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1 — Full mock exam */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("practice.sectionMock.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("practice.sectionMock.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            {/* WRITTEN */}
            <ModuleCard
              icon={<PenTool className="h-5 w-5" />}
              tone="blue"
              title={t("practice.cards.written.title")}
              description={t("practice.cards.written.description")}
              badge={usageLabel(writtenCount, FREE_DAILY_LIMIT.written)}
              bulletsKey="written"
              cta={
                <Button
                  onClick={() => openSetup("written")}
                  disabled={loading !== null || !canTakeWritten}
                  className="w-full gap-2"
                >
                  {loading === "written" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t("practice.states.generating")}</>
                  ) : !canTakeWritten ? (
                    t("practice.badges.limitReached")
                  ) : (
                    <><GraduationCap className="h-4 w-4" /> {t("practice.cards.written.cta")}</>
                  )}
                </Button>
              }
            />

            {/* ORAL */}
            <ModuleCard
              icon={<Mic className="h-5 w-5" />}
              tone="rose"
              title={t("practice.cards.oral.title")}
              description={t("practice.cards.oral.description")}
              badge={usageLabel(oralCount, FREE_DAILY_LIMIT.oral)}
              bulletsKey="oral"
              cta={
                <Button
                  onClick={() => openSetup("oral")}
                  disabled={loading !== null || !canTakeOral}
                  className="w-full gap-2 bg-rose-600 hover:bg-rose-700"
                >
                  {loading === "oral" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t("practice.states.starting")}</>
                  ) : !canTakeOral ? (
                    t("practice.badges.limitReached")
                  ) : (
                    <><GraduationCap className="h-4 w-4" /> {t("practice.cards.oral.cta")}</>
                  )}
                </Button>
              }
            />
          </div>
        </section>

        {/* SECTION 2 — Skill practice */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("practice.sectionSkill.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("practice.sectionSkill.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* LISTENING */}
            <ModuleCard
              icon={<Volume2 className="h-5 w-5" />}
              tone="purple"
              title={t("practice.cards.listening.title")}
              description={t("practice.cards.listening.description")}
              badge={usageLabel(listeningCount, FREE_DAILY_LIMIT.listening)}
              bulletsKey="listening"
              cta={
                <Button
                  onClick={() => openSetup("listening")}
                  disabled={loading !== null || !canTakeListening}
                  className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {loading === "listening" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t("practice.states.generating")}</>
                  ) : !canTakeListening ? (
                    t("practice.badges.limitReached")
                  ) : (
                    <><Volume2 className="h-4 w-4" /> {t("practice.cards.listening.cta")}</>
                  )}
                </Button>
              }
            />

            {/* GRAMMAR */}
            <ModuleCard
              icon={<BookOpen className="h-5 w-5" />}
              tone="green"
              title={t("practice.cards.grammar.title")}
              description={t("practice.cards.grammar.description")}
              badge={t("practice.badges.unlimited")}
              bulletsKey="grammar"
              cta={
                <Link href="/grammar" className="block">
                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <BookOpen className="h-4 w-4" /> {t("practice.cards.grammar.cta")}
                  </Button>
                </Link>
              }
            />

            {/* VOCAB */}
            <ModuleCard
              icon={<span className="text-lg">🃏</span>}
              tone="amber"
              title={t("practice.cards.vocab.title")}
              description={t("practice.cards.vocab.description")}
              badge={t("practice.badges.unlimited")}
              bulletsKey="vocab"
              cta={
                <Link href="/vocabulary" className="block">
                  <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
                    <span>🃏</span> {t("practice.cards.vocab.cta")}
                  </Button>
                </Link>
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}

type Tone = "blue" | "rose" | "purple" | "green" | "amber";

const TONE_STYLES: Record<Tone, { iconBg: string; iconColor: string; bg: string; ring: string; topBorder: string }> = {
  blue:   { iconBg: "bg-blue-100 dark:bg-blue-900/50",     iconColor: "text-blue-600 dark:text-blue-300",     bg: "from-blue-50/70 to-transparent dark:from-blue-950/30",     ring: "ring-blue-200/60 dark:ring-blue-900/40",     topBorder: "from-blue-500 to-indigo-500" },
  rose:   { iconBg: "bg-rose-100 dark:bg-rose-900/50",     iconColor: "text-rose-600 dark:text-rose-300",     bg: "from-rose-50/70 to-transparent dark:from-rose-950/30",     ring: "ring-rose-200/60 dark:ring-rose-900/40",     topBorder: "from-rose-500 to-pink-500" },
  purple: { iconBg: "bg-purple-100 dark:bg-purple-900/50", iconColor: "text-purple-600 dark:text-purple-300", bg: "from-purple-50/70 to-transparent dark:from-purple-950/30", ring: "ring-purple-200/60 dark:ring-purple-900/40", topBorder: "from-purple-500 to-fuchsia-500" },
  green:  { iconBg: "bg-emerald-100 dark:bg-emerald-900/50", iconColor: "text-emerald-600 dark:text-emerald-300", bg: "from-emerald-50/70 to-transparent dark:from-emerald-950/30", ring: "ring-emerald-200/60 dark:ring-emerald-900/40", topBorder: "from-emerald-500 to-teal-500" },
  amber:  { iconBg: "bg-amber-100 dark:bg-amber-900/50",   iconColor: "text-amber-600 dark:text-amber-300",   bg: "from-amber-50/70 to-transparent dark:from-amber-950/30",   ring: "ring-amber-200/60 dark:ring-amber-900/40",   topBorder: "from-amber-500 to-orange-500" },
};

type BulletsKey = "written" | "oral" | "listening" | "grammar" | "vocab";

function ModuleCard({
  icon, tone, title, description, badge, bulletsKey, cta,
}: {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  description: string;
  badge: string;
  bulletsKey: BulletsKey;
  cta: React.ReactNode;
}) {
  const t = TONE_STYLES[tone];
  const { dict } = useI18n();
  const bullets = dict.practice.cards[bulletsKey].bullets;
  return (
    <Card className={cn("relative overflow-hidden border-zinc-200/80 dark:border-zinc-800 ring-1 hover:shadow-lg transition-shadow flex flex-col", t.ring)}>
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.topBorder)} />
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", t.bg)} />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.iconBg, t.iconColor)}>
            {icon}
          </div>
          <Badge variant="outline" className="text-xs">{badge}</Badge>
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="relative flex-1 flex flex-col gap-3">
        <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 flex-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className={t.iconColor}>•</span> {b}
            </li>
          ))}
        </ul>
        <div className="mt-auto">{cta}</div>
      </CardContent>
    </Card>
  );
}
