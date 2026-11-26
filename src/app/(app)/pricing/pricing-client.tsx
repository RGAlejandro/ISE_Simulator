"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotebookHeader, NotebookPage, Stamp } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "monthly" | "yearly";
const PLANS: { key: PlanKey; price: string; periodKey: "forever" | "perMonth" | "perYear"; highlighted: boolean }[] = [
  { key: "free", price: "0 €", periodKey: "forever", highlighted: false },
  { key: "monthly", price: "9,99 €", periodKey: "perMonth", highlighted: true },
  { key: "yearly", price: "89,99 €", periodKey: "perYear", highlighted: false },
];

interface Props {
  signedIn: boolean;
  isPro: boolean;
  isAdmin: boolean;
  renewsAt: string | null;
  canceled: boolean;
  testMode: boolean;
}

export function PricingClient({ signedIn, isPro, isAdmin, renewsAt, canceled, testMode }: Props) {
  const router = useRouter();
  const { dict, t, locale } = useI18n();
  const p = dict.pricing;
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: "monthly" | "yearly") {
    if (!signedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/pricing")}`);
      return;
    }
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.code === "already") { router.refresh(); return; }
      throw new Error(data.code === "config" ? p.errors.config : p.errors.generic);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : p.errors.generic);
      setLoading(null);
    }
  }

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <NotebookHeader title={p.title} subtitle={p.subtitle} />

        {canceled && <p className="mb-6 max-w-2xl border-l-2 border-pen pl-3 text-sm text-ink">{p.canceled}</p>}
        {isPro && (
          <p className="mb-6 flex flex-wrap items-center gap-3 text-sm text-ink">
            <Stamp band="pass">{p.youArePro}</Stamp>
            {isAdmin ? p.adminIncluded : renewsAt ? t("pricing.renews", { date: new Date(renewsAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) }) : null}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const data = p.plans[plan.key];
            const pro = plan.key !== "free";
            const current = pro ? isPro : signedIn && !isPro;
            return (
              <section
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-xl border-2 bg-paper p-6",
                  plan.highlighted ? "border-ink" : "border-rule",
                )}
              >
                {plan.highlighted && (
                  <Stamp band="merit" className="absolute -top-3 left-6 bg-paper">{p.mostPopular}</Stamp>
                )}
                <h2 className="font-display text-2xl font-semibold text-ink">{data.name}</h2>
                <p className="mt-1 text-sm text-ink-soft">{data.description}</p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tabular-nums text-ink">{plan.price}</span>
                  <span className="text-sm text-ink-soft">{p[plan.periodKey]}</span>
                </p>
                {plan.key === "yearly" && <p className="mt-1 font-hand text-lg leading-none text-pen">{p.yearlyNote}</p>}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {data.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {!pro ? (
                    current ? (
                      <Button variant="outline" className="w-full" disabled>{p.currentPlan}</Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => router.push(signedIn ? "/dashboard" : "/sign-up")}>
                        {p.getStartedFree}
                      </Button>
                    )
                  ) : current ? (
                    <Button variant="outline" className="w-full" disabled>{p.youArePro}</Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => subscribe(plan.key as "monthly" | "yearly")}
                      disabled={loading !== null}
                    >
                      {loading === plan.key ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {p.processing}</> : p.subscribe}
                    </Button>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {error && (
          <p className="mt-6 flex items-center gap-1.5 text-sm text-pen" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {testMode && !isPro && (
          <p className="mt-8 flex max-w-2xl items-start gap-2 text-sm text-ink-soft">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" /> {p.testMode}
          </p>
        )}
        {!signedIn && (
          <p className="mt-4 text-sm text-ink-soft">
            <Link href="/sign-in" className="underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker">{dict.nav.signIn}</Link>
          </p>
        )}
      </NotebookPage>
    </div>
  );
}
