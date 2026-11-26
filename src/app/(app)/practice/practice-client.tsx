"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, AudioLines, FileCheck, BookOpenText, GraduationCap, Languages, Layers, Loader2, Mic, PenLine, PenTool, Radio, Volume2, ListChecks } from "lucide-react";
import { NotebookHeader, NotebookPage, Section, Stamp } from "@/components/notebook/notebook";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n/language-provider";
import { FREE_DAILY_LIMIT } from "@/lib/constants";
import { LevelPicker } from "@/components/practice/level-picker";
import { cn } from "@/lib/utils";
import type { UserUsage } from "@/types";

type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";
export type SetupKind = "written" | "listening" | "reading";
type ModuleKey = "rw" | "sl";
type Allowance = { text: string; out: boolean };

interface PracticeClientProps {
  isPro: boolean;
  usage: UserUsage;
  examModules: "BOTH" | "READING_WRITING" | "SPEAKING_LISTENING";
  examLevel: ExamLevel | null;
  /** `/practice?start=reading` opens that mode's level picker straight away (links from the plan, tutor, Readiness). */
  autoStart?: SetupKind | null;
}

const SETUP_ICON: Record<SetupKind, typeof PenTool> = { written: PenTool, listening: Volume2, reading: BookOpenText };
const START_KEY: Record<SetupKind, string> = { written: "startWritten", listening: "startListening", reading: "startReading" };

export function PracticeClient({ isPro, usage, examModules, examLevel, autoStart = null }: PracticeClientProps) {
  const router = useRouter();
  const { t, dict } = useI18n();
  const p = dict.practice.idx;
  const canStart: Record<SetupKind, boolean> = {
    written: usage.canTakeWritten, listening: usage.canTakeListening, reading: usage.canTakeReading,
  };
  const [setupKind, setSetupKind] = useState<SetupKind | null>(autoStart && canStart[autoStart] ? autoStart : null);
  const [setupLevel, setSetupLevel] = useState<ExamLevel | "">(examLevel ?? "");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loading, setLoading] = useState<SetupKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);

  /** Free plan only: what's left today on a limited module. Pro sees nothing. */
  const left = (count: number, limit: number): Allowance | null => {
    if (isPro) return null;
    const n = Math.max(0, limit - count);
    return { out: n === 0, text: n === 0 ? p.none : n === 1 ? p.leftOne : t("practice.idx.leftMany", { n }) };
  };

  const openSetup = (kind: SetupKind) => {
    setError(null);
    setSetupError(null);
    setSetupLevel(examLevel ?? "");
    setSetupKind(kind);
  };

  const submitSetup = async () => {
    if (!setupKind) return;
    if (!setupLevel) {
      setSetupError(t("practice.setup.errors.levelRequired"));
      return;
    }
    const kind = setupKind;
    setSetupKind(null);
    setLoading(kind);
    setGeneratingMessage(t(`practice.loading.${kind}`));
    try {
      // Reading = the written paper's Tasks 1 and 2 only.
      const url = kind === "listening" ? "/api/listening/generate" : "/api/exam/generate";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: setupLevel, ...(kind === "reading" ? { mode: "reading" } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      router.push(kind === "listening" ? `/listening/${data.sessionId}` : `/exam/written/${data.examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
      setGeneratingMessage(null);
    }
  };

  const SetupIcon = setupKind ? SETUP_ICON[setupKind] : null;
  const busy = loading !== null;

  // The module the learner still has to pass comes first and is marked.
  const goal: ModuleKey | null = examModules === "READING_WRITING" ? "rw" : examModules === "SPEAKING_LISTENING" ? "sl" : null;
  const modules: ModuleKey[] = goal === "sl" ? ["sl", "rw"] : ["rw", "sl"];

  const groups: Record<ModuleKey, React.ReactNode> = {
    rw: (
      <>
        <Entry
          icon={PenTool} title={p.written.t} description={p.written.d}
          onClick={() => openSetup("written")} disabled={busy || !usage.canTakeWritten} busy={loading === "written"}
          note={left(usage.writtenCount, FREE_DAILY_LIMIT.written)}
          extra={
            <Link href="/official" className="relative z-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-marker decoration-4 underline-offset-2">
              <FileCheck className="h-3.5 w-3.5" /> {dict.official.entry}
              {!isPro && <Stamp band="pass" tilt={-2}>Pro</Stamp>}
            </Link>
          }
        />
        <Entry
          icon={BookOpenText} title={p.reading.t} description={p.reading.d}
          onClick={() => openSetup("reading")} disabled={busy || !usage.canTakeReading} busy={loading === "reading"}
          note={left(usage.readingCount, FREE_DAILY_LIMIT.reading)}
        />
        <Entry icon={PenLine} title={p.writing.t} description={p.writing.d} href="/writing"
          note={left(usage.writingCount, FREE_DAILY_LIMIT.writing)} />
      </>
    ),
    sl: (
      <>
        <Entry
          icon={Mic} title={p.oral.t} description={p.oral.d}
          href={usage.canTakeOral ? "/exam/oral/setup" : undefined} disabled={!usage.canTakeOral}
          note={left(usage.oralCount, FREE_DAILY_LIMIT.oral)}
          extra={usage.canTakeOral ? (
            <Link href="/exam/oral/setup?mode=live" className="relative z-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-marker decoration-4 underline-offset-2">
              <Radio className="h-3.5 w-3.5" /> {p.live}
              <Stamp band="below" tilt={-2}>Beta</Stamp>
            </Link>
          ) : null}
        />
        <Entry
          icon={Volume2} title={p.listening.t} description={p.listening.d}
          onClick={() => openSetup("listening")} disabled={busy || !usage.canTakeListening} busy={loading === "listening"}
          note={left(usage.listeningCount, FREE_DAILY_LIMIT.listening)}
        />
        <Entry icon={AudioLines} title={p.pronunciation.t} description={p.pronunciation.d} href="/pronunciation" />
      </>
    ),
  };

  return (
    <>
      <Dialog open={setupKind !== null} onOpenChange={(open) => { if (!open) { setSetupKind(null); setSetupError(null); } }}>
        <DialogContent className="sm:max-w-xl">
          {setupKind && SetupIcon && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display text-xl">
                  <SetupIcon className="h-5 w-5 text-ink-soft" /> {t(`practice.setup.${setupKind}Title`)}
                </DialogTitle>
                <DialogDescription>{t(`practice.setup.${setupKind}Description`)}</DialogDescription>
              </DialogHeader>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{t("practice.setup.chooseLevel")}</p>
                <LevelPicker value={setupLevel} onChange={(l) => { setSetupLevel(l); setSetupError(null); }} />
                {setupError && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-pen">
                    <AlertCircle className="h-3.5 w-3.5" /> {setupError}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSetupKind(null)}>{t("common.cancel")}</Button>
                <Button onClick={submitSetup}>{t(`practice.setup.${START_KEY[setupKind]}`)}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {generatingMessage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-paper/80 backdrop-blur-sm" role="status">
          <div className="mx-4 max-w-sm border-y-2 border-ink bg-paper px-8 py-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink" />
            <p className="mt-3 font-display text-lg font-semibold text-ink">{t("practice.loading.title")}</p>
            <p className="mt-1 text-sm text-ink-soft">{generatingMessage}</p>
            <p className="mt-3 text-xs text-ink-soft">{t("practice.loading.hint")}</p>
          </div>
        </div>
      )}

      <div className="flex-1 bg-paper">
        <NotebookPage className="pb-16">
          <NotebookHeader title={t("practice.title")} subtitle={t("practice.description")} />

          {error && (
            <p className="mb-6 flex items-start gap-2 text-sm text-pen" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {modules.map((m, i) => (
            <Section
              key={m}
              n={i + 1}
              title={<CategoryTitle cat={m}>{p[m]}</CategoryTitle>}
              action={goal === m ? <Stamp band="pass">{p.yourGoal}</Stamp> : undefined}
            >
              <ul className={cn(GRID, `cat-${m}`)}>{groups[m]}</ul>
            </Section>
          ))}

          <Section n={3} title={<CategoryTitle cat="lang">{p.lang}</CategoryTitle>}>
            <ul className={cn(GRID, "cat-lang")}>
              <Entry icon={Layers} title={p.vocab.t} description={p.vocab.d} href="/vocabulary" />
              <Entry icon={GraduationCap} title={p.grammar.t} description={p.grammar.d} href="/grammar" />
              <Entry icon={Languages} title={p.translation.t} description={p.translation.d} href="/translation"
                note={left(usage.translationCount, FREE_DAILY_LIMIT.translation)} />
              <Entry icon={ListChecks} title={p.quiz.t} description={p.quiz.d} href="/quiz" />
            </ul>
          </Section>
        </NotebookPage>
      </div>
    </>
  );
}

const GRID = "grid gap-3 sm:grid-cols-3 sm:gap-4";

/** Section heading with the module's colour dot. */
function CategoryTitle({ cat, children }: { cat: ModuleKey | "lang"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full cat-dot", `cat-${cat}`)} />
      {children}
    </span>
  );
}

/** One practice mode: a tinted box in its module's colour (set by the parent list). The whole box is the link. */
function Entry({ icon: Icon, title, description, href, onClick, disabled, busy, note, extra }: {
  icon: typeof PenTool;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Free-plan allowance left today; red handwriting once it's used up. */
  note?: Allowance | null;
  extra?: React.ReactNode;
}) {
  const stretch = "after:absolute after:inset-0 after:content-['']";
  const titleCls = cn(
    "block text-left font-display text-xl font-semibold tracking-tight text-ink outline-none",
    stretch,
  );
  return (
    <li
      data-disabled={disabled || undefined}
      className={cn("cat-tile relative flex gap-3.5 rounded-xl p-4 sm:block sm:p-5", disabled && "opacity-60")}
    >
      <span className="cat-chip grid h-10 w-10 shrink-0 place-items-center rounded-lg" aria-hidden>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <div className="sm:mt-4">
          {href && !disabled ? (
            <Link href={href} className={titleCls}>{title}</Link>
          ) : (
            <button type="button" onClick={onClick} disabled={disabled} className={cn(titleCls, "disabled:cursor-not-allowed")}>{title}</button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
        {note && (
          <p className={cn("mt-2", note.out ? "font-hand text-lg leading-none text-pen" : "text-xs text-ink-soft")}>{note.text}</p>
        )}
        {extra && <div className="mt-3">{extra}</div>}
      </div>
    </li>
  );
}
