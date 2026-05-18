import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";

export const LOCALES = ["en", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_META: Record<Locale, { label: string; flag: string; native: string }> = {
  en: { label: "English", flag: "🇬🇧", native: "English" },
  es: { label: "Spanish", flag: "🇪🇸", native: "Español" },
  fr: { label: "French",  flag: "🇫🇷", native: "Français" },
};

export const DICTIONARIES = { en, es, fr } as const;
export const DEFAULT_LOCALE: Locale = "en";

export type { Dictionary } from "./dictionaries/en";
