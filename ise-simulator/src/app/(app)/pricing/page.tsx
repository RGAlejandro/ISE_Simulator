"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "1 written exam per day",
      "1 oral exam per day",
      "Basic score & pass/fail result",
      "All ISE levels available",
      "Reading auto-correction",
    ],
    highlighted: false,
    priceId: null,
  },
  {
    name: "Pro Monthly",
    price: "$9.99",
    period: "/month",
    description: "Unlimited practice with full feedback",
    features: [
      "Unlimited written exams",
      "Unlimited oral exams",
      "Detailed AI writing feedback",
      "Grammar & vocabulary analysis",
      "Pronunciation & fluency feedback",
      "Progress analytics",
      "Priority AI model (Gemini 2.5 Flash)",
    ],
    highlighted: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "monthly",
  },
  {
    name: "Pro Yearly",
    price: "$89.99",
    period: "/year",
    description: "Best value — save 25%",
    features: [
      "Everything in Pro Monthly",
      "Save 25% vs monthly",
      "Personalized study plans",
      "Priority support",
    ],
    highlighted: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || "yearly",
  },
];

export default function PricingPage() {
  const router = useRouter();
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
          Start free and upgrade when you&apos;re ready for unlimited AI-powered practice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${
              plan.highlighted
                ? "border-2 border-blue-600 shadow-xl"
                : ""
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-sm text-zinc-500">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-zinc-500">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
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
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</>
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              ) : (
                <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard")}>
                  Get Started Free
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
