"use client";

import { motion } from "framer-motion";
import { BookOpen, Mic, PenTool, BarChart3, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: PenTool,
    title: "Written Exam Simulator",
    description:
      "Practice with AI-generated ISE exams: 2 reading tasks, reading-into-writing, and extended writing — all in authentic Trinity format.",
  },
  {
    icon: Mic,
    title: "Oral Exam Simulator",
    description:
      "Face an AI examiner with real voice. Complete topic task, collaborative task, conversation, and listening — just like the real exam.",
  },
  {
    icon: BarChart3,
    title: "Detailed Feedback",
    description:
      "Get scored on grammar, vocabulary, task fulfillment, fluency, and pronunciation. Know exactly where to improve.",
  },
  {
    icon: Zap,
    title: "Instant Generation",
    description:
      "Every exam is unique. AI generates fresh content each time so you never see the same questions twice.",
  },
  {
    icon: Shield,
    title: "All ISE Levels",
    description:
      "From ISE Foundation (A2) to ISE IV (C2). Pick your level and practice at the difficulty that matches your goal.",
  },
  {
    icon: BookOpen,
    title: "Study Tips & Guides",
    description:
      "Expert strategies for each task type. Learn what examiners look for and how to maximize your score.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Everything you need to pass your ISE exam
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Our AI-powered platform simulates the complete Trinity ISE exam experience,
            giving you unlimited practice with instant feedback.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="relative rounded-2xl border border-zinc-200 bg-zinc-50 p-8 transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
                <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
