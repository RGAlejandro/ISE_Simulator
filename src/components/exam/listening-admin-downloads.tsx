"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, AudioLines, Loader2 } from "lucide-react";

interface Props {
  passageText: string;
  passageTitle: string;
  passageTopic: string;
  level: string;
  informationType?: string;
  voice?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation",
  ISE_I: "ISE I",
  ISE_II: "ISE II",
  ISE_III: "ISE III",
  ISE_IV: "ISE IV",
};

function safeFileName(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "listening";
}

/**
 * Admin-only downloads for a listening passage: the full script as a PDF and
 * the generated audio as MP3. Rendered only when the user is an admin.
 */
export function ListeningAdminDownloads({
  passageText,
  passageTitle,
  passageTopic,
  level,
  informationType,
  voice,
}: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      // Fetch the model answers (solution) for both tasks.
      let task1ModelAnswer = "";
      let task2KeyPoints: string[] = [];
      try {
        const res = await fetch("/api/listening/model-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passageText, passageTitle, informationType }),
        });
        if (res.ok) {
          const data = await res.json();
          task1ModelAnswer = data.task1ModelAnswer ?? "";
          task2KeyPoints = Array.isArray(data.task2KeyPoints) ? data.task2KeyPoints : [];
        }
      } catch {
        // Non-fatal — PDF still includes the transcript.
      }

      const { jsPDF } = await import("jspdf");
      const W = 210, H = 297, ML = 18, MR = 18, TW = W - ML - MR;
      const BOTTOM = H - 18;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const header = (subtitle: string): number => {
        let y = 22;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        doc.text("Listening — Script & Answers", ML, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(90, 90, 90);
        doc.text(`${LEVEL_LABELS[level] ?? level}  ·  ${passageTitle}`, ML, y);
        y += 5;
        doc.text(subtitle, ML, y);
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(ML, y, W - MR, y);
        doc.setTextColor(20, 20, 20);
        return y + 8;
      };

      // ── PAGE 1: Transcript — auto-shrink the font so the whole script fits ──
      let y = header(`Topic: ${passageTopic}`);
      const avail = BOTTOM - y;
      let scriptSize = 12;
      let lineH = scriptSize * 0.42;
      doc.setFont("helvetica", "normal");
      // Reduce font (12 → 7) until the transcript fits the remaining space.
      for (; scriptSize >= 7; scriptSize -= 0.5) {
        doc.setFontSize(scriptSize);
        lineH = scriptSize * 0.42;
        const lineCount = (doc.splitTextToSize(passageText, TW) as string[]).length;
        if (lineCount * lineH <= avail) break;
      }
      doc.setFontSize(scriptSize);
      for (const line of doc.splitTextToSize(passageText, TW) as string[]) {
        doc.text(line, ML, y);
        y += lineH;
      }

      // ── PAGE 2: Task answers ──
      if (task1ModelAnswer || task2KeyPoints.length) {
        doc.addPage();
        y = header("Model answers");

        const paragraph = (text: string, size = 11, lh = 6) => {
          doc.setFontSize(size);
          for (const line of doc.splitTextToSize(text, TW) as string[]) {
            if (y + lh > BOTTOM) { doc.addPage(); y = 22; }
            doc.text(line, ML, y);
            y += lh;
          }
        };
        const heading = (text: string) => {
          if (y + 12 > BOTTOM) { doc.addPage(); y = 22; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.text(text, ML, y);
          y += 7;
          doc.setFont("helvetica", "normal");
        };

        heading("Task 1 — General Summary (model answer)");
        paragraph(task1ModelAnswer || "—", 11, 6);
        y += 4;

        heading("Task 2 — Detailed Notes (key points)");
        if (task2KeyPoints.length) {
          task2KeyPoints.forEach((p) => paragraph(`- ${p}`, 11, 6));
        } else {
          paragraph("—", 11, 6);
        }
      }

      doc.save(`${safeFileName(passageTitle)}-listening.pdf`);
    } catch (err) {
      console.error("[listening-pdf]", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadAudio = async () => {
    setAudioLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: passageText, voice }),
      });
      if (!res.ok) throw new Error("Audio generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName(passageTitle)}-audio.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[listening-audio]", err);
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Admin tools
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadPdf} disabled={pdfLoading} variant="outline" size="sm" className="gap-2">
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Download script + results (PDF)
        </Button>
        <Button onClick={downloadAudio} disabled={audioLoading} variant="outline" size="sm" className="gap-2">
          {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
          Download audio (MP3)
        </Button>
      </div>
    </div>
  );
}
