"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Languages } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Language / Idioma"
        className="inline-flex items-center gap-1.5 h-9 px-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="text-lg leading-none" aria-hidden="true">{LOCALE_META[locale].flag}</span>
        <Languages className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-1 z-50"
        >
          {LOCALES.map((l: Locale) => {
            const meta = LOCALE_META[l];
            const active = locale === l;
            return (
              <button
                key={l}
                role="menuitem"
                onClick={() => { setLocale(l); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors text-left",
                  active
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">{meta.flag}</span>
                <span className="flex-1">{meta.native}</span>
                {active && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
