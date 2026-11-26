"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { BandStamp, LockedNote } from "@/components/results/results-parts";
import { FilePicker, Steps, prepareUploads, useOfficialError } from "@/components/official/official-parts";
import { EXAM_LEVELS } from "@/lib/constants";

interface PaperRow {
  id: string;
  title: string;
  level: string;
  status: "PARSED" | "TRANSCRIBED" | "MARKED";
  score: number | null;
  createdAt: string;
}

export function OfficialHomeClient({ isPro, papers }: { isPro: boolean; papers: PaperRow[] }) {
  const { dict, locale } = useI18n();
  const o = dict.official;
  const router = useRouter();
  const errorText = useOfficialError();
  const [paper, setPaper] = useState<File[]>([]);
  const [key, setKey] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const levelLabel = (v: string) => EXAM_LEVELS.find((l) => l.value === v)?.label ?? v;

  async function read() {
    if (paper.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of await prepareUploads(paper)) form.append("paper", f);
      for (const f of await prepareUploads(key)) form.append("key", f);
      const res = await fetch("/api/official", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw Object.assign(new Error(), { code: data.code, status: res.status });
      router.push(`/official/${data.id}`);
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(errorText(e.code, e.status));
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <NotebookHeader title={o.title} subtitle={o.subtitle} />

        {!isPro ? (
          <LockedNote title={o.lockedTitle} body={o.lockedBody} />
        ) : (
          <Section n={1} title={o.steps[0]}>
            <div className="max-w-2xl space-y-6">
              <Steps current={0} />
              <FilePicker label={o.paperLabel} hint={o.paperHint} files={paper} onChange={setPaper} disabled={busy} />
              <FilePicker label={o.keyLabel} hint={o.keyHint} files={key} onChange={setKey} multiple={false} disabled={busy} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Button size="lg" onClick={read} disabled={busy || paper.length === 0}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{o.readingPaper}</> : o.read}
                </Button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-sm text-pen" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}
            </div>
          </Section>
        )}

        <Section n={isPro ? 2 : 1} title={o.historyTitle}>
          {papers.length === 0 ? (
            <p className="text-sm text-ink-soft">{o.historyEmpty}</p>
          ) : (
            <ul className="max-w-3xl divide-y divide-rule border-y border-rule">
              {papers.map((p) => (
                <li key={p.id}>
                  <Link href={`/official/${p.id}`} className="group flex items-center gap-4 py-3">
                    <span className="w-20 shrink-0 text-sm tabular-nums text-ink-soft">
                      {new Date(p.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2">{p.title}</span>
                      <span className="block text-xs text-ink-soft">{levelLabel(p.level)}</span>
                    </span>
                    {p.status === "MARKED" && p.score != null ? (
                      <span className="flex items-center gap-3">
                        <BandStamp pct={p.score} />
                        <span className="w-14 text-right font-display text-lg font-semibold tabular-nums text-ink">{Math.round(p.score)}{" "}%</span>
                      </span>
                    ) : (
                      <span className="font-hand text-lg text-pen">{o.status[p.status]}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </NotebookPage>
    </div>
  );
}
