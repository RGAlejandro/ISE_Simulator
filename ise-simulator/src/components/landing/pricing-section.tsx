"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
    notIncluded: [
      "Detailed AI writing feedback",
      "Oral pronunciation analysis",
      "Progress analytics",
      "Personalized study tips",
    ],
    cta: "Get Started",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    yearlyPrice: "$89.99/year",
    description: "Unlimited practice with full feedback",
    features: [
      "Unlimited written exams",
      "Unlimited oral exams",
      "Detailed AI feedback on writings",
      "Grammar & vocabulary analysis",
      "Pronunciation & fluency feedback",
      "Progress analytics & radar charts",
      "Personalized study recommendations",
      "Priority AI (Gemini 2.5 Flash)",
    ],
    notIncluded: [],
    cta: "Upgrade to Pro",
    href: "/sign-up",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Start free. Upgrade when you&apos;re ready for unlimited practice.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:max-w-4xl lg:mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? "border-2 border-blue-600 bg-white shadow-xl dark:bg-zinc-950"
                  : "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.description}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{plan.price}</span>
                <span className="text-zinc-500 dark:text-zinc-400">{plan.period}</span>
              </div>
              {plan.yearlyPrice && (
                <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                  or {plan.yearlyPrice} (save 25%)
                </p>
              )}

              <Link href={plan.href} className="mt-6 block">
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 opacity-40">
                    <Check className="h-5 w-5 shrink-0" />
                    <span className="text-sm text-zinc-500 line-through">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
