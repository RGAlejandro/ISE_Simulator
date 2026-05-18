"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold">ISE Simulator</span>
            </Link>
            <p className="mt-3 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("footer.product")}</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">{t("nav.dashboard")}</Link></li>
              <li><Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">{t("nav.pricing")}</Link></li>
              <li><Link href="/tips" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">{t("nav.tips")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("footer.examLevels")}</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-zinc-500 dark:text-zinc-400">ISE Foundation (A2)</span></li>
              <li><span className="text-sm text-zinc-500 dark:text-zinc-400">ISE I (B1)</span></li>
              <li><span className="text-sm text-zinc-500 dark:text-zinc-400">ISE II (B2)</span></li>
              <li><span className="text-sm text-zinc-500 dark:text-zinc-400">ISE III (C1)</span></li>
              <li><span className="text-sm text-zinc-500 dark:text-zinc-400">ISE IV (C2)</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <p className="text-center text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} ISE Simulator. {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
