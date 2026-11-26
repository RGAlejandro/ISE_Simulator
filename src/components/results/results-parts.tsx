"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkBar, InkLink, Section, Stamp, type StampBand } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { EXAM_LEVELS } from "@/lib/constants";

/** Trinity band from a 0–100 score: 50 Pass, 65 Merit, 80 Distinction. */
export function bandOf(pct: number): StampBand {
  if (pct >= 80) return "distinction";
  if (pct >= 65) return "merit";
  if (pct >= 50) return "pass";
  return "below";
}

export function BandStamp({ pct, band: forced, className }: { pct: number; band?: StampBand; className?: string }) {
  const { dict } = useI18n();
  const band = forced ?? bandOf(pct);
  return <Stamp band={band} className={className}>{dict.readiness.band[band]}</Stamp>;
}

/** "ISE III · Written exam · 22 November 2026" */
export function useResultEyebrow(level: string, kind: string, createdAt: string) {
  const { locale } = useI18n();
  const levelLabel = EXAM_LEVELS.find((l) => l.value === level)?.label ?? level.replace("_", " ");
  const date = new Date(createdAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  return `${levelLabel} · ${kind} · ${date}`;
}

/**
 * The module's band. Trinity passes Reading & Writing only when EACH skill
 * reaches Pass: one skill below 50 % means the module isn't passed, whatever
 * the average.
 */
export function moduleBand(score: number, parts: (number | null)[] = []): StampBand {
  return parts.some((p) => p != null && p < 50) ? "below" : bandOf(score);
}

/** The skill (of those given) that is below Pass while the average isn't, if any. */
export function failingSkill(score: number | null, parts: { label: string; pct: number | null }[]): string | null {
  if (score == null || score < 50) return null;
  return parts.find((p) => p.pct != null && p.pct < 50)?.label ?? null;
}

/** Big overall score with its stamp, for the page title. */
export function ScoreTitle({ score, parts }: { score: number | null; parts?: (number | null)[] }) {
  const { dict } = useI18n();
  if (score == null) return <>{dict.results.pending}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="tabular-nums">{score}{"\u00a0"}%</span>
      <BandStamp pct={score} band={moduleBand(score, parts)} className="text-xs" />
    </span>
  );
}

export function BackLink() {
  const { dict } = useI18n();
  return (
    <Link href="/dashboard" className="inline-flex items-center gap-1.5 pt-6 text-sm text-ink-soft hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> {dict.results.back}
    </Link>
  );
}

/** One skill line in the summary: label, score, stamp, bar with the Pass mark. */
export function SkillScore({ label, sublabel, score, detail }: {
  label: string;
  sublabel: string;
  score: number | null;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{sublabel}</p>
          <h3 className="font-display text-xl font-semibold text-ink">{label}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {score != null && <BandStamp pct={score} />}
          <span className="font-display text-3xl font-semibold tabular-nums text-ink">{score != null ? `${score}\u00a0%` : "—"}</span>
        </div>
      </div>
      {score != null && <InkBar value={score} mark={50} className="mt-3" />}
      <p className="mt-2 text-xs text-ink-soft">{detail}</p>
    </div>
  );
}

/** A Trinity criterion: name, score on its scale, bar and the examiner's comment. */
export function CriterionScore({ label, score, max, comments }: { label: string; score: number; max: number; comments?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-display text-lg font-semibold tabular-nums text-ink">{score}/{max}</span>
      </div>
      <InkBar value={score} max={max} className="mt-1.5" />
      {comments && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{comments}</p>}
    </div>
  );
}

export function Suggestions({ items }: { items: string[] }) {
  const { dict } = useI18n();
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{dict.results.suggestions}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
            <span aria-hidden className="shrink-0 font-hand text-lg leading-5 text-pen">→</span> {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pro upsell in the notebook style (ruled box, no card). */
export function LockedNote({ title, body }: { title: string; body: string }) {
  const { dict } = useI18n();
  return (
    <div className="mx-auto max-w-md border-y-2 border-ink px-6 py-5 text-center">
      <Lock className="mx-auto h-5 w-5 text-ink-soft" />
      <p className="mt-2 font-display text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/pricing">{dict.results.upgrade}</Link>
      </Button>
    </div>
  );
}

/** Closing section: what to do after reading the result. Hidden for admins viewing a learner. */
export function NextSteps({ n, again }: { n: number; again?: { href: string; label: string } }) {
  const { dict } = useI18n();
  const r = dict.results;
  return (
    <Section n={n} title={r.nextTitle}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button asChild size="lg">
          <Link href={again?.href ?? "/practice"}>{again?.label ?? r.again}</Link>
        </Button>
        <InkLink href="/readiness">{r.seeProgress}</InkLink>
        <InkLink href="/dashboard">{r.back}</InkLink>
      </div>
    </Section>
  );
}
