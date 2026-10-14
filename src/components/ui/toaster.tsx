"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      show: (message: string) => {
        if (typeof window !== "undefined") console.log("[toast]", message);
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const show = React.useCallback((message: string, variant: ToastVariant = "default") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition-all animate-in fade-in slide-in-from-right-5",
              t.variant === "success" && "bg-green-50/95 border-green-200 text-green-800 dark:bg-green-950/95 dark:border-green-800 dark:text-green-200",
              t.variant === "error" && "bg-red-50/95 border-red-200 text-red-800 dark:bg-red-950/95 dark:border-red-800 dark:text-red-200",
              t.variant === "default" && "bg-white/95 border-zinc-200 text-zinc-800 dark:bg-zinc-900/95 dark:border-zinc-700 dark:text-zinc-200"
            )}
          >
            {t.variant === "success" && <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />}
            {t.variant === "error" && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
            <p className="text-sm flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
