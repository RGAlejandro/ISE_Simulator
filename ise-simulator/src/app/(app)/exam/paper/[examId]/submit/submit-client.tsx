"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadPdfButton } from "@/components/exam/download-pdf-button";
import { Upload, FileImage, FileText, X, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import type { WrittenExamContent } from "@/types";

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation (A2)",
  ISE_I: "ISE I (B1)",
  ISE_II: "ISE II (B2)",
  ISE_III: "ISE III (C1)",
  ISE_IV: "ISE IV (C2)",
};

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

interface Props {
  examId: string;
  level: string;
  content: WrittenExamContent;
}

export function SubmitPaperClient({ examId, level, content }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB)");
      return;
    }
    setFile(f);
    setError(null);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("examId", examId);
      fd.append("file", file);

      const res = await fetch("/api/exam/paper/grade", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grading failed");
      router.push(`/exam/paper/${examId}/results?submissionId=${data.submissionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Back */}
        <Link href={`/exam/written/${examId}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to exam
        </Link>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Submit Paper Exam</h1>
            <Badge variant="outline">{LEVEL_LABELS[level] ?? level}</Badge>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload a photo or scan of your completed exam for AI grading.
          </p>
        </div>

        {/* Step 1 — Download */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">1</span>
              <CardTitle className="text-base">Download the exam</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Print and fill it by hand, or complete it digitally in a PDF editor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DownloadPdfButton content={content} level={level} examId={examId} />
          </CardContent>
        </Card>

        {/* Step 2 — Upload */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">2</span>
              <CardTitle className="text-base">Upload your completed exam</CardTitle>
            </div>
            <CardDescription className="text-sm">
              JPG, PNG, WebP, or PDF. Max 10 MB. For best results use good lighting and keep text flat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  dragging
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                    : "border-zinc-300 dark:border-zinc-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                }`}
              >
                <Upload className="h-8 w-8 text-zinc-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">JPG · PNG · WebP · PDF</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                {/* Preview */}
                {preview ? (
                  <img src={preview} alt="Exam preview" className="w-full rounded-lg object-contain max-h-64" />
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-3">
                    <FileText className="h-6 w-6 text-zinc-500" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{file.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <FileImage className="h-3.5 w-3.5" />
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="flex items-center gap-1 text-red-500 hover:text-red-700"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={!file || submitting}
            className="w-full gap-2 h-11"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI is grading your exam... (this may take 30–60s)
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Submit for AI Grading
              </>
            )}
          </Button>
          {submitting && (
            <p className="text-center text-xs text-zinc-500">
              Gemini Vision is reading your handwriting and grading each section. Please wait.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
