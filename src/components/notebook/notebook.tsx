import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Exam notebook" building blocks: content sits on the paper itself — no
 * boxed cards. Sections are separated by hairline rules, numbered in an
 * exercise-book margin, with marker highlights, stamps and red-pen notes.
 */

/** Page column with the exercise-book margin line (desktop only). */
export function NotebookPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-5xl px-4 sm:px-6 lg:pl-32 lg:pr-8", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[5.5rem] hidden lg:block">
        <div className="h-full w-px bg-margin" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[5.75rem] hidden lg:block">
        <div className="h-full w-px bg-margin opacity-60" />
      </div>
      {children}
    </div>
  );
}

/** Page heading: eyebrow, serif title, optional subtitle and a right-hand slot. */
export function NotebookHeader({ eyebrow, title, subtitle, aside, className }: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-10 pb-8", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{eyebrow}</p>}
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink text-balance">{title}</h1>
        {subtitle && <p className="max-w-2xl text-base text-ink-soft leading-relaxed">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

/** A numbered section: hairline rule on top, number in the margin, serif heading. */
export function Section({ n, title, eyebrow, action, children, className, id }: {
  n?: number | string;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative border-t border-rule pt-6 pb-10", className)}>
      {n !== undefined && (
        <span aria-hidden className="absolute -left-28 top-5 hidden w-16 text-right font-display text-3xl font-semibold text-ink-soft/50 lg:block tabular-nums">
          {n}
        </span>
      )}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{eyebrow}</p>}
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {n !== undefined && <span className="mr-2 text-ink-soft/60 lg:hidden">{n}.</span>}
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Text link with an arrow — the secondary action style. */
export function InkLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker", className)}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** "Label ········ value" rows, like a table of contents. */
export function Ledger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-transparent", className)}>{children}</dl>;
}

export function LedgerRow({ label, value, hint, emphasis }: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline gap-2">
        <dt className="shrink-0 text-sm text-ink">{label}</dt>
        <span aria-hidden className="min-w-6 flex-1 -translate-y-1 border-b-2 border-dotted border-rule" />
        <dd className={cn("shrink-0 font-display tabular-nums text-ink", emphasis ? "text-2xl font-semibold" : "text-lg font-medium")}>{value}</dd>
      </div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export type StampBand = "below" | "pass" | "merit" | "distinction";

const STAMP_COLOR: Record<StampBand, string> = {
  below: "var(--stamp-below)",
  pass: "var(--stamp-pass)",
  merit: "var(--stamp-merit)",
  distinction: "var(--stamp-distinction)",
};

/** Examiner's grade stamp. */
export function Stamp({ band, children, className, tilt = -3 }: {
  band: StampBand;
  children: React.ReactNode;
  className?: string;
  tilt?: number;
}) {
  const color = STAMP_COLOR[band];
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-[3px] border-2 px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-90", className)}
      style={{ color, borderColor: color, transform: `rotate(${tilt}deg)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 25%, transparent)` }}
    >
      {children}
    </span>
  );
}

/** Handwritten red-pen annotation. Use at most one or two per screen. */
export function PenNote({ children, className, arrow = true }: { children: React.ReactNode; className?: string; arrow?: boolean }) {
  return (
    <span className={cn("inline-block -rotate-2 font-hand text-xl leading-none text-pen", className)}>
      {arrow && <span aria-hidden className="mr-1">←</span>}
      {children}
    </span>
  );
}

/** Thin progress line in ink, with an optional pass mark. */
export function InkBar({ value, max = 100, mark, className, tone = "ink" }: {
  value: number;
  max?: number;
  mark?: number;
  className?: string;
  tone?: "ink" | "pen";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("relative h-1.5 w-full rounded-full bg-rule", className)}>
      <div className={cn("h-full rounded-full", tone === "pen" ? "bg-pen" : "bg-ink")} style={{ width: `${pct}%` }} />
      {mark !== undefined && (
        <div aria-hidden className="absolute -top-1 h-3.5 w-px bg-ink-soft" style={{ left: `${Math.max(0, Math.min(100, (mark / max) * 100))}%` }} />
      )}
    </div>
  );
}
