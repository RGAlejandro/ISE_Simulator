"use client";

import { motion } from "framer-motion";
import { MousePointerClick, Brain, Trophy } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: MousePointerClick,
    title: "Choose your module",
    description: "Pick your ISE level and the skill you want to practise — written exam, oral simulation, listening, grammar, or vocabulary flashcards.",
    color: "bg-blue-500",
    ring: "ring-blue-200 dark:ring-blue-900",
    iconBg: "bg-blue-100 dark:bg-blue-900",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    step: "02",
    icon: Brain,
    title: "Practice with AI",
    description: "The AI generates unique content every session. Speak to the examiner, fill in your answers, flip vocab cards — fully interactive.",
    color: "bg-purple-500",
    ring: "ring-purple-200 dark:ring-purple-900",
    iconBg: "bg-purple-100 dark:bg-purple-900",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    step: "03",
    icon: Trophy,
    title: "Get instant feedback",
    description: "Receive detailed scores on grammar, vocabulary, task fulfillment, and more. Know exactly what to fix before exam day.",
    color: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-900",
    iconBg: "bg-emerald-100 dark:bg-emerald-900",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-28 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            From zero to exam-ready in three simple steps
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3">

          {/* Animated connecting line (desktop only) */}
          <div className="hidden md:block absolute top-8 left-[calc(16.666%+1rem)] right-[calc(16.666%+1rem)] h-0.5">
            <div className="relative w-full h-full bg-zinc-200 dark:bg-zinc-700 rounded-full">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeInOut", delay: 0.5 }}
                style={{ originX: 0 }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"
              />
            </div>
          </div>

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.5 }}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Step number circle */}
                <div className="relative mb-6">
                  <motion.div
                    whileInView={{ scale: [0.8, 1.05, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.2 + 0.3, duration: 0.5 }}
                    className={`relative z-10 h-16 w-16 rounded-full ${step.color} flex items-center justify-center text-white text-xl font-bold shadow-lg`}
                  >
                    {step.step}
                  </motion.div>
                  {/* Pulse ring */}
                  <motion.div
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.7 }}
                    className={`absolute inset-0 rounded-full ${step.color} opacity-30`}
                  />
                </div>

                {/* Icon */}
                <div className={`h-12 w-12 rounded-2xl ${step.iconBg} flex items-center justify-center mb-4 ring-4 ${step.ring} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`h-6 w-6 ${step.iconColor}`} />
                </div>

                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                  {step.title}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm max-w-xs">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
