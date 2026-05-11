"use client";

import { motion } from "framer-motion";

const steps = [
  {
    step: "01",
    title: "Choose your level",
    description:
      "Select from ISE Foundation (A2) to ISE IV (C2). Each exam is tailored to match the real Trinity ISE format and difficulty.",
  },
  {
    step: "02",
    title: "Take the exam",
    description:
      "Complete your written exam with reading comprehension and writing tasks, or face the AI examiner in a full oral simulation.",
  },
  {
    step: "03",
    title: "Get instant feedback",
    description:
      "Receive detailed scores across grammar, vocabulary, task fulfillment, and more. Know exactly what to improve before exam day.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            How it works
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Three simple steps to better exam preparation
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3">
          {steps.map((step, idx) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                {step.step}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {step.title}
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
