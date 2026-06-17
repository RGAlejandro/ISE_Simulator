"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MessagesSquare, Users, Volume2, FileText,
  ArrowLeft, ArrowRight, Upload, Check, AlertCircle, Loader2, Sparkles,
} from "lucide-react";
import { EXAM_LEVELS, ORAL_TASK_MINUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";
type OralTaskType = "TOPIC" | "COLLABORATIVE" | "CONVERSATION" | "LISTENING";

const ALLOWED_TASKS_BY_LEVEL: Record<ExamLevel, OralTaskType[]> = {
  ISE_FOUNDATION: ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_I:          ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_II:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_III:        ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_IV:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
};

const TASK_META: Record<OralTaskType, { icon: typeof Mic; label: string; description: string }> = {
  TOPIC:         { icon: Mic,            label: "Topic task",          description: "Discuss your prepared topic with the examiner. You bring the agenda." },
  COLLABORATIVE: { icon: Users,          label: "Collaborative task",  description: "Examiner presents a situation. You ask questions, debate pros/cons, conclude. B2+ only." },
  CONVERSATION:  { icon: MessagesSquare, label: "Conversation task",   description: "Free conversation on level-specific subject areas." },
  LISTENING:     { icon: Volume2,        label: "Independent listening", description: "Listen to a recording, summarise + answer follow-ups." },
};

// ISE III/IV: Topic = formal presentation + discussion (official Trinity spec)
const TOPIC_FORMAL_DESC: Partial<Record<ExamLevel, string>> = {
  ISE_III: "4-minute formal presentation of your prepared topic, then up to 4 minutes defending it in discussion with the examiner.",
  ISE_IV:  "Formal presentation of up to 5 minutes, then an extended discussion where you defend your ideas.",
};

/** Official per-task minutes for the selected level (Trinity Guide for Students). */
function taskMinutes(level: ExamLevel | "", task: OralTaskType): number | null {
  if (!level) return null;
  return ORAL_TASK_MINUTES[level]?.[task] ?? null;
}

interface Props {
  initialLevel: string | null;
}

type Step = "level" | "tasks" | "topic" | "review";

export function OralSetupClient({ initialLevel }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(initialLevel ? "tasks" : "level");
  const [level, setLevel] = useState<ExamLevel | "">((initialLevel as ExamLevel) ?? "");
  const [tasks, setTasks] = useState<Set<OralTaskType>>(new Set(["TOPIC", "CONVERSATION", "LISTENING"]));
  const [topicGeneral, setTopicGeneral] = useState("");
  const [topicDetailed, setTopicDetailed] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // null = not yet checked (SSR-safe), false = browser lacks Web Speech API
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);

  // Detect speech recognition support up front, BEFORE the exam starts —
  // starting consumes the free user's daily oral exam, so they must know now.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const allowedTasks: OralTaskType[] = level ? ALLOWED_TASKS_BY_LEVEL[level as ExamLevel] : [];

  const selectLevel = (l: ExamLevel) => {
    setLevel(l);
    // Reset tasks to defaults allowed at this level
    setTasks(new Set(ALLOWED_TASKS_BY_LEVEL[l]));
    setStep("tasks");
  };

  const toggleTask = (t: OralTaskType) => {
    const next = new Set(tasks);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTasks(next);
    setError(null);
  };

  const goToTopic = () => {
    if (tasks.size === 0) {
      setError("Select at least one task to continue.");
      return;
    }
    if (tasks.has("TOPIC")) setStep("topic");
    else setStep("review");
  };

  const goToReview = () => {
    if (tasks.has("TOPIC") && !topicGeneral.trim() && !topicDetailed.trim()) {
      setError("Please add some topic content (general or detailed) before continuing.");
      return;
    }
    setError(null);
    setStep("review");
  };

  const onPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    setPdfFileName(file.name);
    setPdfUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/exam/oral/upload-topic", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse PDF");
      // Append extracted text to detailed essay (preserve existing content)
      setTopicDetailed(prev => (prev.trim() ? `${prev.trim()}\n\n${data.text}` : data.text));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to parse PDF");
      setPdfFileName(null);
    } finally {
      setPdfUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startExam = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/exam/oral/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          selectedTasks: Array.from(tasks),
          topicGeneral: topicGeneral.trim() || null,
          topicDetailed: topicDetailed.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start exam");
      router.push(`/exam/oral/${data.examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-rose-950/30 dark:via-pink-950/20 dark:to-purple-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-rose-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/practice" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to practice
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
              <Mic className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">Oral exam setup</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Configure your exam — choose level, tasks, and prepare your topic.</p>

          {/* Step indicator */}
          <div className="mt-5 flex items-center gap-2 text-xs font-medium">
            <StepDot active={step === "level"} done={step !== "level" && level !== ""} label="Level" />
            <StepConn done={step !== "level"} />
            <StepDot active={step === "tasks"} done={step === "topic" || step === "review"} label="Tasks" />
            <StepConn done={step === "topic" || step === "review"} />
            <StepDot active={step === "topic"} done={step === "review"} label="Topic" disabled={!tasks.has("TOPIC")} />
            <StepConn done={step === "review"} />
            <StepDot active={step === "review"} done={false} label="Review" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {speechSupported === false && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Your browser does not support speech recognition, which the oral exam needs for voice answers.
              Please use <strong>Chrome</strong> or <strong>Edge</strong> to take the oral exam.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1 — Level */}
        {step === "level" && (
          <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">Choose your level</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Tasks available depend on the level (Collaborative is B2+).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXAM_LEVELS.map(l => (
                <button
                  key={l.value}
                  onClick={() => selectLevel(l.value as ExamLevel)}
                  className="text-left rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 p-4 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">{l.label}</span>
                    <Badge variant="outline" className="text-[10px]">{l.cefr}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ALLOWED_TASKS_BY_LEVEL[l.value as ExamLevel].length} oral tasks available
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* STEP 2 — Tasks */}
        {step === "tasks" && level && (
          <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
            <div className="flex items-end justify-between mb-1">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Choose tasks</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Full exam by default. Uncheck to skip any.</p>
              </div>
              <Badge variant="outline">{level.replace("ISE_", "ISE ")}</Badge>
            </div>

            <div className="mt-4 space-y-2">
              {(["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"] as OralTaskType[]).map(t => {
                const enabled = allowedTasks.includes(t);
                const checked = tasks.has(t);
                const meta = TASK_META[t];
                const Icon = meta.icon;
                const minutes = taskMinutes(level, t);
                const description = t === "TOPIC"
                  ? (TOPIC_FORMAL_DESC[level as ExamLevel] ?? meta.description)
                  : meta.description;
                return (
                  <button
                    key={t}
                    onClick={() => enabled && toggleTask(t)}
                    disabled={!enabled}
                    className={cn(
                      "w-full text-left flex items-start gap-3 rounded-xl border p-4 transition-all",
                      !enabled && "opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-800",
                      enabled && checked && "border-rose-400 bg-rose-50/50 dark:border-rose-700 dark:bg-rose-950/30",
                      enabled && !checked && "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
                      enabled && checked ? "bg-rose-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
                    )}>
                      {enabled && checked ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{meta.label}</span>
                        {minutes !== null && <Badge variant="outline" className="text-[10px]">~{minutes} min</Badge>}
                        {!enabled && <Badge variant="outline" className="text-[10px]">Not available at this level</Badge>}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep("level")} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Change level
              </Button>
              <Button onClick={goToTopic} className="gap-1.5 bg-rose-600 hover:bg-rose-700">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        )}

        {/* STEP 3 — Topic */}
        {step === "topic" && tasks.has("TOPIC") && (
          <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">Prepare your Topic</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Add the general bullet points the examiner can refer to, plus your full detailed essay. You can also upload a PDF.
            </p>

            {/* PDF upload */}
            <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/40 p-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                  {pdfUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Upload your topic PDF (optional)</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {pdfFileName ? `Loaded: ${pdfFileName}` : "Max 5 MB. We'll extract the text and append it to the detailed essay below."}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onPdfChange}
                  className="hidden"
                  disabled={pdfUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pdfUploading}
                  className="gap-1.5 shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {pdfUploading ? "Parsing..." : "Choose PDF"}
                </Button>
              </div>
              {pdfError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" /> {pdfError}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">
                  General points (bullet list / outline)
                </label>
                <textarea
                  value={topicGeneral}
                  onChange={e => setTopicGeneral(e.target.value)}
                  rows={5}
                  placeholder="• Main idea&#10;• Sub-point 1&#10;• Sub-point 2&#10;• Conclusion"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">{topicGeneral.trim().split(/\s+/).filter(Boolean).length} words</p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">
                  Detailed essay (full text)
                </label>
                <textarea
                  value={topicDetailed}
                  onChange={e => setTopicDetailed(e.target.value)}
                  rows={12}
                  placeholder="Write your full prepared essay here. The examiner will use this to ask follow-up questions and dive deeper..."
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">{topicDetailed.trim().split(/\s+/).filter(Boolean).length} words</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep("tasks")} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={goToReview} className="gap-1.5 bg-rose-600 hover:bg-rose-700">
                Review <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        )}

        {/* STEP 4 — Review */}
        {step === "review" && level && (
          <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">Ready to start?</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Quick recap before launching.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">Level</p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1">{level.replace("ISE_", "ISE ")}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">Tasks ({tasks.size})</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"] as OralTaskType[]).filter(t => tasks.has(t)).map(t => (
                    <Badge key={t} className="border-0 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px]">
                      {TASK_META[t].label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {tasks.has("TOPIC") && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Topic content</p>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">General points</p>
                    <p className="text-zinc-500 dark:text-zinc-400 line-clamp-3">{topicGeneral.trim() || "(none)"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Detailed essay</p>
                    <p className="text-zinc-500 dark:text-zinc-400 line-clamp-3">{topicDetailed.trim() || "(none)"}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(tasks.has("TOPIC") ? "topic" : "tasks")} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={startExam} disabled={submitting || speechSupported === false} className="gap-2 bg-rose-600 hover:bg-rose-700">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Start oral exam</>
                )}
              </Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StepDot({ active, done, label, disabled }: { active: boolean; done: boolean; label: string; disabled?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors",
      active && "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      done && !active && "text-zinc-500 dark:text-zinc-400",
      !active && !done && !disabled && "text-zinc-400 dark:text-zinc-500",
      disabled && "text-zinc-300 dark:text-zinc-700",
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        active && "bg-rose-600 dark:bg-rose-300",
        done && !active && "bg-emerald-500",
        !active && !done && "bg-zinc-300 dark:bg-zinc-600",
      )} />
      {label}
    </span>
  );
}

function StepConn({ done }: { done: boolean }) {
  return <span className={cn("h-px w-4 sm:w-8", done ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700")} />;
}
