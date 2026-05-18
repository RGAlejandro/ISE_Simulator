"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

export function CTASection() {
  const t = useT();
  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-12 text-center sm:px-12 sm:py-16 lg:px-16 lg:py-24"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              {t("landing.cta.title")}
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg text-blue-100 px-2">
              {t("landing.cta.body")}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 text-base px-8"
                >
                  {t("landing.cta.button")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
