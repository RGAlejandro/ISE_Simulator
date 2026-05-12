"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const CYCLE: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

const CONFIG: Record<Theme, { icon: React.ElementType; label: string; iconColor: string; hoverBg: string }> = {
  system: {
    icon: Monitor,
    label: "System",
    iconColor: "text-zinc-400 dark:text-zinc-500",
    hoverBg: "hover:bg-zinc-100 dark:hover:bg-zinc-800",
  },
  light: {
    icon: Sun,
    label: "Light",
    iconColor: "text-amber-500",
    hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
  },
  dark: {
    icon: Moon,
    label: "Dark",
    iconColor: "text-indigo-400",
    hoverBg: "hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
  },
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { icon: Icon, label, iconColor, hoverBg } = CONFIG[theme];

  return (
    <button
      onClick={() => setTheme(CYCLE[theme])}
      title={`Theme: ${label} — click to switch`}
      aria-label={`Switch theme (current: ${label})`}
      className={`relative h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200 ${iconColor} ${hoverBg}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -120, scale: 0.3, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 120, scale: 0.3, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-center"
        >
          <Icon className="h-[18px] w-[18px]" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
