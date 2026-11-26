"use client";

import { useId, useRef } from "react";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/language-provider";
import { downscaleImage } from "@/lib/image-resize";

export const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Shrink photos (handwriting stays legible at 2000 px); PDFs go as they are. */
export function prepareUploads(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => (f.type.startsWith("image/") ? downscaleImage(f, 2000, 0.88) : Promise.resolve(f))));
}

/** File list with add / remove, in the notebook style. */
export function FilePicker({ label, hint, files, onChange, multiple = true, disabled }: {
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { dict } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</label>
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      </div>
      {files.length > 0 && (
        <ul className="divide-y divide-rule border-y border-rule">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-2 text-sm text-ink">
              {f.type === "application/pdf" ? <FileText className="h-4 w-4 shrink-0 text-ink-soft" /> : <ImageIcon className="h-4 w-4 shrink-0 text-ink-soft" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-soft">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                disabled={disabled}
                className="shrink-0 text-ink-soft hover:text-pen"
                aria-label={`${dict.official.remove} ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-dashed border-ink/40 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-ink",
          disabled && "opacity-50",
        )}
      >
        <Paperclip className="h-4 w-4" /> {dict.official.choose}
      </button>
    </div>
  );
}

/** 1 · 2 · 3 · 4 progress line. */
export function Steps({ current }: { current: number }) {
  const { dict } = useI18n();
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {dict.official.steps.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2", i === current ? "font-semibold text-ink" : i < current ? "text-ink-soft line-through decoration-1" : "text-ink-soft")}>
          <span className={cn("grid h-6 w-6 place-items-center rounded-full border text-xs tabular-nums", i === current ? "border-ink bg-ink text-paper" : "border-rule")}>
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Translated message for an API error code. */
export function useOfficialError() {
  const { dict } = useI18n();
  const e = dict.official.errors;
  return (code: unknown, status?: number): string =>
    code === "files" ? e.files
      : code === "notPaper" ? e.notPaper
        : code === "limit" || status === 429 ? e.limit
          : code === "mark" ? e.mark
            : e.read;
}
