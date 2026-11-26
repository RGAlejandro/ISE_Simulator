"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InkLink, NotebookHeader, NotebookPage, Stamp } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";

export function SuccessClient({ result }: { result: "active" | "pending" | "invalid" }) {
  const { dict } = useI18n();
  const s = dict.pricing.success;
  const router = useRouter();
  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {result === "active" ? (
          <>
            <NotebookHeader
              eyebrow={<Stamp band="distinction">Pro</Stamp>}
              title={s.title}
              subtitle={s.body}
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild size="lg"><Link href="/dashboard">{s.toDashboard}</Link></Button>
              <InkLink href="/official">{s.tryOfficial}</InkLink>
              <InkLink href="/chat">{s.tryTutor}</InkLink>
            </div>
          </>
        ) : result === "pending" ? (
          <>
            <NotebookHeader title={s.pending} subtitle={s.pendingBody} />
            <Button size="lg" onClick={() => router.refresh()}>{s.refresh}</Button>
          </>
        ) : (
          <>
            <NotebookHeader title={s.invalid} subtitle={s.invalidBody} />
            <InkLink href="/pricing">{s.backToPricing}</InkLink>
          </>
        )}
      </NotebookPage>
    </div>
  );
}
