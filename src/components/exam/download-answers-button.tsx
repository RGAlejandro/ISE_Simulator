"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Loader2, AlertTriangle } from "lucide-react";
import type { WrittenExamContent } from "@/types";

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation",
  ISE_I: "ISE I",
  ISE_II: "ISE II",
  ISE_III: "ISE III",
  ISE_IV: "ISE IV",
};

interface Props {
  content: WrittenExamContent;
  level: string;
  examId: string;
}

export function DownloadAnswersButton({ content, level, examId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");

      const W = 210, H = 297;
      const ML = 18, MR = 18;
      const TW = W - ML - MR;
      const FOOT_Y = H - 18;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 0;
      const levelLabel = LEVEL_LABELS[level] ?? level;

      const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
      };
      const gray = (g: number) => doc.setTextColor(g, g, g);
      const lw = (w: number) => doc.setLineWidth(w);

      const newPage = (withHeader = true) => {
        doc.addPage();
        if (withHeader) {
          font(8, "normal");
          gray(80);
          doc.text(`${levelLabel} — Answer Key`, ML, 10);
          doc.text("CONFIDENTIAL", W - MR, 10, { align: "right" });
          doc.setTextColor(0);
          doc.setDrawColor(180, 180, 180);
          lw(0.3);
          doc.line(ML, 12.5, W - MR, 12.5);
          y = 18;
        } else {
          y = 15;
        }
      };

      const check = (needed: number) => {
        if (y + needed > FOOT_Y) newPage();
      };

      const sectionHeader = (title: string, subtitle?: string) => {
        check(14);
        font(11, "bold");
        doc.setTextColor(0);
        doc.text(title, ML, y);
        if (subtitle) {
          font(8, "italic");
          gray(110);
          doc.text(subtitle, W - MR, y, { align: "right" });
          doc.setTextColor(0);
        }
        y += 4;
        doc.setDrawColor(0);
        lw(0.4);
        doc.line(ML, y, W - MR, y);
        y += 6;
      };

      const subHeader = (title: string) => {
        check(8);
        font(9.5, "bold");
        doc.setTextColor(0);
        doc.text(title, ML, y);
        y += 5;
      };

      const answerRow = (num: number, value: string, extra?: string) => {
        check(5.5);
        font(9, "bold");
        doc.setTextColor(0);
        doc.text(`${num}.`, ML + 2, y);
        font(9.5, "bold");
        doc.setTextColor(20, 100, 50);
        doc.text(value, ML + 14, y);
        if (extra) {
          font(8, "italic");
          gray(110);
          doc.text(`— ${extra}`, ML + 36, y);
          doc.setTextColor(0);
        }
        y += 5.5;
      };

      const note = (text: string) => {
        font(7.5, "italic");
        gray(110);
        const lines = doc.splitTextToSize(text, TW - 4) as string[];
        for (const ln of lines) { doc.text(ln, ML + 2, y); y += 3.8; }
        doc.setTextColor(0);
        y += 2;
      };

      // ── COVER ───────────────────────────────────────────────────────
      y = 30;

      font(8, "normal");
      gray(100);
      doc.text("Trinity College London", ML, 11);
      doc.text(`${levelLabel} — Sample Paper`, W - MR, 11, { align: "right" });
      doc.setDrawColor(0);
      lw(0.3);
      doc.line(ML, 14, W - MR, 14);
      doc.setTextColor(0);

      font(10, "normal");
      gray(80);
      doc.text("INTEGRATED SKILLS IN ENGLISH", ML, y);
      doc.setTextColor(0);
      y += 12;

      font(28, "bold");
      doc.text(`${levelLabel} — Answer Key`, ML, y);
      y += 10;

      font(13, "normal");
      gray(70);
      doc.text("Reading sections only · Tasks 1 & 2", ML, y);
      doc.setTextColor(0);
      y += 12;

      doc.setDrawColor(0);
      lw(0.5);
      doc.line(ML, y, W - MR, y);
      y += 12;

      // Warning callout box
      doc.setFillColor(255, 247, 230);
      doc.setDrawColor(220, 150, 30);
      lw(0.5);
      doc.rect(ML, y, TW, 38, "FD");
      font(10, "bold");
      doc.setTextColor(180, 90, 0);
      doc.text("⚠  Important — Do not consult before practising", ML + 5, y + 7);
      font(9, "normal");
      doc.setTextColor(80, 50, 0);
      const warnLines = doc.splitTextToSize(
        "This answer key reveals the correct responses for the reading questions (Q1–Q30). Looking at these answers before completing the exam defeats the purpose of practice. Use this document ONLY after you have finished your attempt, to self-check your work.",
        TW - 10,
      ) as string[];
      let wy = y + 13;
      for (const ln of warnLines) { doc.text(ln, ML + 5, wy); wy += 4.5; }
      doc.setTextColor(0);
      y += 38 + 10;

      font(9, "normal");
      doc.setTextColor(0);
      doc.text(`Exam reference: ${examId.slice(-6).toUpperCase()}`, ML, y);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, ML, y + 5);

      font(7.5, "normal");
      gray(120);
      doc.text("Writing tasks (Task 3 & Task 4) are not included — they are subjective and require examiner judgement.", ML, H - 14);
      doc.setTextColor(0);

      // ── TASK 1 ANSWERS ──────────────────────────────────────────────
      newPage(true);
      sectionHeader("Task 1 — Long Reading", "Questions 1–15 · 15 marks");

      // Q1-5 paragraph matching
      subHeader("Questions 1–5  ·  Paragraph matching");
      note("Each paragraph matches one summary/title (A–F). One option is extra.");
      const t1Match = content.reading1.paragraphMatching;
      for (let i = 0; i < t1Match.correctAnswers.length; i++) {
        const letter = t1Match.correctAnswers[i];
        const opt = t1Match.options.find(o => o.letter === letter);
        answerRow(i + 1, letter, opt?.summary);
      }
      y += 3;

      // Q6-10 statement selection
      subHeader("Questions 6–10  ·  True statements");
      note("Five statements (A–H) from the box are TRUE. Order does not matter.");
      const t1Stmt = content.reading1.statementSelection;
      check(t1Stmt.correctAnswers.length * 5.5 + 4);
      for (let i = 0; i < t1Stmt.correctAnswers.length; i++) {
        const letter = t1Stmt.correctAnswers[i];
        const s = t1Stmt.statements.find(x => x.letter === letter);
        answerRow(6 + i, letter, s?.text);
      }
      y += 3;

      // Q11-15 gap fill
      subHeader("Questions 11–15  ·  Gap-fill answers");
      const t1Gap = content.reading1.gapFill.questions;
      for (let i = 0; i < t1Gap.length; i++) {
        answerRow(11 + i, t1Gap[i].correctAnswer);
      }

      // ── TASK 2 ANSWERS ──────────────────────────────────────────────
      newPage(true);
      sectionHeader("Task 2 — Multi-text Reading", "Questions 16–30 · 15 marks");

      // Q16-20 text matching
      subHeader("Questions 16–20  ·  Text matching");
      note("Each statement refers to one of the texts (A, B, C or D). One letter is used twice.");
      const t2Match = content.reading2.textMatching;
      for (let i = 0; i < t2Match.correctAnswers.length; i++) {
        const letter = t2Match.correctAnswers[i];
        const q = t2Match.questions[i];
        answerRow(16 + i, letter, q?.statement);
      }
      y += 3;

      // Q21-25 statement selection
      subHeader("Questions 21–25  ·  True statements");
      note("Five statements (A–H) from the box are TRUE according to the texts. Order does not matter.");
      const t2Stmt = content.reading2.statementSelection;
      check(t2Stmt.correctAnswers.length * 5.5 + 4);
      for (let i = 0; i < t2Stmt.correctAnswers.length; i++) {
        const letter = t2Stmt.correctAnswers[i];
        const s = t2Stmt.statements.find(x => x.letter === letter);
        answerRow(21 + i, letter, s?.text);
      }
      y += 3;

      // Q26-30 gap fill
      subHeader("Questions 26–30  ·  Notes gap-fill answers");
      const t2Gap = content.reading2.gapFill.questions;
      for (let i = 0; i < t2Gap.length; i++) {
        answerRow(26 + i, t2Gap[i].correctAnswer);
      }

      // ── FOOTERS ─────────────────────────────────────────────────────
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        font(7, "normal");
        gray(130);
        doc.text(`Answer Key — page ${p} of ${total}`, ML, H - 6);
        doc.text("For self-assessment use only", W - MR, H - 6, { align: "right" });
        doc.setTextColor(0);
      }

      doc.save(`ISE_${levelLabel.replace(/\s/g, "_")}_${examId.slice(-6)}_ANSWERS.pdf`);
      setOpen(false);
    } catch (err) {
      console.error("[answers-pdf]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
      >
        <Eye className="h-3.5 w-3.5" />
        Answers
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!loading) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle>Download answers?</DialogTitle>
            </div>
            <DialogDescription>
              You&apos;re about to download a PDF revealing the correct answers for Task 1 and Task 2 (Reading).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              <strong>Recommended:</strong> use this only <em>after</em> you finish the exam. Looking at the answers beforehand undermines your practice — you won&apos;t actually train your English skills and the score won&apos;t reflect your real level.
            </p>
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
              Note: Task 3 and Task 4 (Writing) are not included — they are subjective and need examiner feedback.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleDownload}
              disabled={loading}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Eye className="h-4 w-4" /> Download anyway</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
