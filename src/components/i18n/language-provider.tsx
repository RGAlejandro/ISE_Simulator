"use client";

import { createContext, useContext, useEffect, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { DICTIONARIES, DEFAULT_LOCALE, LOCALES, type Locale, type Dictionary } from "@/i18n";

type TParam = string | number;
type Translate = (key: string, params?: Record<string, TParam>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translate;
  dict: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "ise-locale";

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const nav = window.navigator?.language?.slice(0, 2)?.toLowerCase();
  if (isLocale(nav)) return nav;
  return DEFAULT_LOCALE;
}

// External store for locale (so useSyncExternalStore syncs across tabs + listeners)
const localeListeners = new Set<() => void>();
function subscribeLocale(cb: () => void) {
  localeListeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    localeListeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
function notifyLocale() {
  localeListeners.forEach(l => l());
}

function resolveKey(dict: Dictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

function interpolate(template: string, params?: Record<string, TParam>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeLocale,
    readLocale,
    () => DEFAULT_LOCALE,
  );

  // Reflect locale to <html lang>
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, l);
    notifyLocale();
  }, []);

  const dict = DICTIONARIES[locale];

  const t = useCallback<Translate>((key, params) => {
    const value = resolveKey(dict, key);
    if (typeof value === "string") return interpolate(value, params);
    if (value === undefined) return key;
    return key;
  }, [dict]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
