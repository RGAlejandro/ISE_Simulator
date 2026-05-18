"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";

const PLAN_CONFIG = [
  { key: "free",    price: "$0",     periodKey: "forever",  highlighted: false, priceId: null },
  { key: "monthly", price: "$9.99",  periodKey: "perMonth", highlighted: true,  priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "monthly" },
  { key: "yearly",  price: "$89.99", periodKey: "perYear",  highlighted: false, priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID  || "yearly"  },
] as const;

export default function PricingPage() {
  const router = useRouter();
  const { t, dict } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Failed to create checkout session");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("pricing.title")}
        </h1>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg text-zinc-500 dark:text-zinc-400 px-2">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 lg:gap-8 max-w-5xl mx-auto">
        {PLAN_CONFIG.map((plan) => {
          const data = dict.pricing.plans[plan.key];
          const period = t(`pricing.${plan.periodKey}`);
          return (
            <Card
              key={plan.key}
              className={`relative ${plan.highlighted ? "border-2 border-blue-600 shadow-xl" : ""}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                  {t("pricing.mostPopular")}
                </div>
              )}
              <CardHeader>
                <CardTitle>{data.name}</CardTitle>
                <p className="text-sm text-zinc-500">{data.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-zinc-500">{period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {data.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-zinc-700 dark:text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.priceId ? (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.priceId!)}
                    disabled={loading !== null}
                  >
                    {loading === plan.priceId ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {t("pricing.processing")}</>
                    ) : (
                      t("pricing.subscribe")
                    )}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard")}>
                    {t("pricing.getStartedFree")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
