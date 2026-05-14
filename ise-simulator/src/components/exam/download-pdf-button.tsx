"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
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

export function DownloadPdfButton({ content, level, examId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");

      const W = 210, H = 297;
      const ML = 18, MR = 18;
      const TW = W - ML - MR;
      const FOOT_Y = H - 22;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 0;
      const levelLabel = LEVEL_LABELS[level] ?? level;

      const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
      };
      const lw = (w: number) => doc.setLineWidth(w);
      const gray = (g: number) => doc.setTextColor(g, g, g);

      const dottedLine = (x1: number, yy: number, x2: number) => {
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.setDrawColor(150, 150, 150);
        lw(0.25);
        doc.line(x1, yy, x2, yy);
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0);
      };

      const solidLine = (x1: number, yy: number, x2: number, lineW = 0.35) => {
        doc.setDrawColor(0);
        lw(lineW);
        doc.line(x1, yy, x2, yy);
      };

      const borderBox = (x: number, yy: number, w: number, h: number, lineW = 0.4) => {
        doc.setDrawColor(0);
        lw(lineW);
        doc.rect(x, yy, w, h, "S");
      };

      const addPage = (fullHeader = false) => {
        doc.addPage();
        if (fullHeader) {
          font(9, "bold");
          doc.setTextColor(0);
          doc.text(`Integrated Skills in English  ${levelLabel}`, ML, 11);
          solidLine(ML, 13.5, W - MR);
          y = 18;
        } else {
          font(8, "normal");
          gray(80);
          doc.text(levelLabel, W - MR, 10, { align: "right" });
          doc.setTextColor(0);
          y = 15;
        }
      };

      const check = (needed: number) => {
        if (y + needed > FOOT_Y) addPage();
      };

      const taskHeader = (num: number, name: string) => {
        font(12, "bold");
        doc.setTextColor(0);
        doc.text(`TASK ${num}  ${name}`, ML, y);
        y += 5;
        solidLine(ML, y, W - MR);
        y += 8;
      };

      const qHeader = (title: string, instr: string) => {
        check(18);
        font(10, "bold");
        doc.setTextColor(0);
        doc.text(title, ML, y);
        y += 5.5;
        font(9, "normal");
        const lines = doc.splitTextToSize(instr, TW) as string[];
        for (const ln of lines) { doc.text(ln, ML, y); y += 4.8; }
        y += 3;
      };

      // ── Two-column section: answer blanks LEFT, bordered options box RIGHT ──
      const twoColSection = (
        leftItems: { num: number; label?: string }[],
        rightTitle: string,
        rightRows: { key: string; lines: string[] }[],
        leftColW: number,
      ) => {
        const ROW_LH = 5.0;
        const ROW_PAD = 2.5;
        let boxH = 9;
        for (const r of rightRows) {
          boxH += Math.max(r.lines.length, 1) * ROW_LH + ROW_PAD;
        }

        const RX = ML + leftColW + 4;
        const RC = TW - leftColW - 4;

        check(boxH + 4);
        const top = y;
        const ANS_LH = boxH / Math.max(leftItems.length, 1);

        // Left column: answer blanks
        for (let i = 0; i < leftItems.length; i++) {
          const ay = top + i * ANS_LH + ANS_LH / 2 + 1;
          font(9, "normal");
          doc.setTextColor(0);
          doc.text(`${leftItems[i].num}`, ML, ay);
          if (leftItems[i].label) {
            font(8.5, "italic");
            gray(60);
            doc.text(leftItems[i].label!, ML + 7, ay);
            doc.setTextColor(0);
            font(9, "normal");
            dottedLine(ML + 7 + doc.getTextWidth(leftItems[i].label!) + 3, ay, ML + leftColW - 2);
          } else {
            dottedLine(ML + 8, ay, ML + leftColW - 2);
          }
        }

        // Right column: bordered box
        borderBox(RX, top, RC, boxH);
        font(8, "bold");
        doc.setTextColor(0);
        doc.text(rightTitle, RX + 3, top + 6);
        lw(0.3);
        doc.setDrawColor(0);
        doc.line(RX, top + 8, RX + RC, top + 8);

        let oy = top + 8 + ROW_LH;
        for (const row of rightRows) {
          font(9, "bold");
          doc.setTextColor(0);
          doc.text(row.key, RX + 3.5, oy);
          font(9, "normal");
          for (const ln of row.lines) {
            doc.text(ln, RX + 11, oy);
            oy += ROW_LH;
          }
          if (row.lines.length === 0) oy += ROW_LH;
          oy += ROW_PAD;
        }
        y = top + boxH + 7;
      };

      // ── Inline gap-fill sentence ──
      const gapSentence = (num: number, sentence: string) => {
        const GAP_W = 27;
        const LH = 5.2;
        const parts = sentence.split("_______");
        const before = `${num}   ${(parts[0] ?? "").trim()}`;
        const after = (parts[1] ?? "").trim();

        check(LH + 4);
        font(9, "normal");
        doc.setTextColor(0);

        const prefixW = doc.getTextWidth(before);
        const afterW = after ? doc.getTextWidth(after) : 0;

        if (prefixW + GAP_W + 4 + afterW <= TW) {
          doc.text(before, ML, y);
          const gx = ML + prefixW + 3;
          dottedLine(gx, y, gx + GAP_W);
          if (after) doc.text(after, gx + GAP_W + 3, y);
          y += LH + 4;
        } else {
          const beforeLines = doc.splitTextToSize(before, TW - GAP_W - 8) as string[];
          for (let bi = 0; bi < beforeLines.length - 1; bi++) {
            check(LH);
            doc.text(beforeLines[bi], ML, y);
            y += LH;
          }
          const last = beforeLines[beforeLines.length - 1];
          doc.text(last, ML, y);
          const lastW = doc.getTextWidth(last);
          const gx = ML + lastW + 3;
          dottedLine(gx, y, gx + GAP_W);
          if (after) {
            const remaining = W - MR - gx - GAP_W - 4;
            if (remaining > 10 && doc.getTextWidth(after) <= remaining) {
              doc.text(after, gx + GAP_W + 3, y);
              y += LH + 4;
            } else {
              y += LH;
              const afterLines = doc.splitTextToSize(after, TW) as string[];
              for (const al of afterLines) { check(LH); doc.text(al, ML, y); y += LH; }
              y += 4;
            }
          } else {
            y += LH + 4;
          }
        }
      };

      // ────────────────────────────────────────────────────────────
      // COVER PAGE
      // ────────────────────────────────────────────────────────────
      y = 30;
      font(18, "bold");
      doc.setTextColor(0);
      doc.text("Integrated Skills in English", ML, y);
      y += 13;

      font(26, "bold");
      doc.text(levelLabel, ML, y);
      y += 11;

      font(15, "normal");
      doc.text("Reading & Writing exam", ML, y);
      y += 9;

      solidLine(ML, y, W - MR, 0.5);
      y += 10;

      font(12, "bold");
      doc.text("Practice Exam", ML, y);
      y += 16;

      // Candidate info — labeled dotted underlines
      font(8.5, "normal");
      doc.setTextColor(0);
      doc.text("Candidate name", ML, y);
      y += 5;
      dottedLine(ML, y, ML + TW);
      y += 12;

      doc.text("Centre number", ML, y);
      doc.text("Candidate number", ML + TW / 2, y);
      y += 5;
      dottedLine(ML, y, ML + TW / 2 - 8);
      dottedLine(ML + TW / 2, y, ML + TW);
      y += 15;

      // Instructions box
      const instrItems = [
        "1.  Answer ALL questions in Tasks 1 and 2.",
        "2.  Complete ONE writing task in Task 3 and ONE in Task 4.",
        "3.  Write your answers clearly in the spaces provided.",
        "4.  Texts for Task 3 are taken from Task 2.",
      ];
      font(9.5, "bold");
      doc.setTextColor(0);
      doc.text("Instructions to candidates", ML, y);
      y += 5;
      const instrBoxH = instrItems.length * 5.5 + 9;
      borderBox(ML, y, TW, instrBoxH);
      let iy = y + 8;
      font(9, "normal");
      for (const item of instrItems) { doc.text(item, ML + 5, iy); iy += 5.5; }
      y += instrBoxH + 10;

      // Information for candidates
      font(9.5, "bold");
      doc.setTextColor(0);
      doc.text("Information for candidates", ML, y);
      y += 6;
      const infoItems = [
        "Time allowed: 2 hours 30 minutes",
        "This exam paper has four tasks.",
        "Task 1 and Task 2 have 15 questions each. Tasks 3 and 4 are writing tasks.",
      ];
      font(9, "normal");
      for (const item of infoItems) {
        doc.text(`•  ${item}`, ML + 3, y);
        y += 5.5;
      }

      // ────────────────────────────────────────────────────────────
      // TASK 1 — LONG READING
      // ────────────────────────────────────────────────────────────
      addPage(true);
      taskHeader(1, "Long Reading");

      font(9, "normal");
      doc.setTextColor(0);
      doc.text("Read the following passage and answer Questions 1–15.", ML, y);
      y += 9;

      font(12, "bold");
      doc.text(content.reading1.title, ML, y);
      y += 9;

      for (const p of content.reading1.paragraphs) {
        font(9, "normal");
        const paraLines = doc.splitTextToSize(p.text, TW - 14) as string[];
        const blockH = paraLines.length * 4.8 + 5;
        check(blockH + 6);

        font(9, "bold");
        doc.setTextColor(0);
        doc.text(`${p.number}`, ML + 2, y + 5);

        font(9, "normal");
        let py = y + 5;
        for (const ln of paraLines) { doc.text(ln, ML + 12, py); py += 4.8; }
        y = py + 1;

        lw(0.15);
        doc.setDrawColor(190, 190, 190);
        doc.line(ML, y, W - MR, y);
        doc.setDrawColor(0);
        y += 4;
      }
      y += 3;

      // Q1–5 paragraph matching
      qHeader("Questions 1–5", content.reading1.paragraphMatching.instructions);
      {
        const opts = content.reading1.paragraphMatching.options;
        const paras = content.reading1.paragraphs;
        const optW = TW * 0.55 - 14;
        font(9, "normal");
        const renderedOpts = opts.map(opt => ({
          key: opt.letter,
          lines: doc.splitTextToSize(opt.summary, optW) as string[],
        }));
        const leftItems = paras.map((p, i) => ({ num: i + 1, label: `Paragraph ${p.number}` }));
        twoColSection(leftItems, "Summary options", renderedOpts, Math.round(TW * 0.42));
      }

      // Q6–10 statement selection
      qHeader("Questions 6–10", content.reading1.statementSelection.instructions);
      {
        const stmts = content.reading1.statementSelection.statements;
        const stmtW = TW * 0.62 - 14;
        font(9, "normal");
        const renderedStmts = stmts.map(s => ({
          key: s.letter,
          lines: doc.splitTextToSize(s.text, stmtW) as string[],
        }));
        const leftItems6 = Array.from({ length: 5 }, (_, i) => ({ num: 6 + i }));
        twoColSection(leftItems6, "Statements", renderedStmts, Math.round(TW * 0.33));
      }

      // Q11–15 gap fill
      qHeader("Questions 11–15", `${content.reading1.gapFill.instructions} Each answer must be 1–3 words.`);
      for (let i = 0; i < content.reading1.gapFill.questions.length; i++) {
        gapSentence(11 + i, content.reading1.gapFill.questions[i].sentence);
      }

      // ────────────────────────────────────────────────────────────
      // TASK 2 — MULTI-TEXT READING
      // ────────────────────────────────────────────────────────────
      addPage();
      taskHeader(2, "Multi-Text Reading");

      font(9, "normal");
      doc.setTextColor(0);
      doc.text(`Topic: ${content.reading2.topic}`, ML, y);
      y += 9;

      // Q16–20 FIRST — text matching with right-margin blank
      qHeader("Questions 16–20", content.reading2.textMatching.instructions);
      {
        const tmQs = content.reading2.textMatching.questions;
        const BLANK_W = 16;
        const Q_LH = 5.0;
        font(9, "normal");
        for (let i = 0; i < tmQs.length; i++) {
          const stmtText = `${16 + i}   ${tmQs[i].statement}`;
          const stmtLines = doc.splitTextToSize(stmtText, TW - BLANK_W - 8) as string[];
          const rowH = Math.max(stmtLines.length * Q_LH + 3, 9);
          check(rowH + 2);

          doc.setTextColor(0);
          const rowTop = y;
          let ty = y + Q_LH;
          for (const ln of stmtLines) { doc.text(ln, ML, ty); ty += Q_LH; }
          dottedLine(W - MR - BLANK_W, rowTop + rowH / 2 + 1, W - MR - 2);
          y += rowH;
        }
        y += 5;
      }

      // Texts A, B, C, D
      font(10, "bold");
      doc.setTextColor(0);
      doc.text("Texts", ML, y);
      y += 7;

      for (const t of content.reading2.texts) {
        font(9, "normal");
        const bodyLines = doc.splitTextToSize(t.content, TW - 6) as string[];
        const boxH = bodyLines.length * 4.8 + 12;
        check(boxH + 6);

        font(9, "bold");
        doc.setTextColor(0);
        doc.text(`Text ${t.letter}:  ${t.title}`, ML, y);
        if (t.source) {
          font(7.5, "normal");
          gray(90);
          doc.text(
            `${t.source}${t.author ? `  —  ${t.author}` : ""}`,
            W - MR, y, { align: "right" }
          );
          doc.setTextColor(0);
        }
        y += 5;

        borderBox(ML, y, TW, boxH - 6);
        font(9, "normal");
        let ty = y + 6;
        for (const ln of bodyLines) { doc.text(ln, ML + 3, ty); ty += 4.8; }
        y += boxH - 4;
      }
      y += 4;

      // Q21–25 statement selection
      qHeader("Questions 21–25", content.reading2.statementSelection.instructions);
      {
        const stmts2 = content.reading2.statementSelection.statements;
        const s2W = TW * 0.62 - 14;
        font(9, "normal");
        const rendered2 = stmts2.map(s => ({
          key: s.letter,
          lines: doc.splitTextToSize(s.text, s2W) as string[],
        }));
        const leftItems2 = Array.from({ length: 5 }, (_, i) => ({ num: 21 + i }));
        twoColSection(leftItems2, "Statements", rendered2, Math.round(TW * 0.33));
      }

      // Q26–30 gap fill
      qHeader("Questions 26–30", `${content.reading2.gapFill.instructions} Each answer must be 1–3 words.`);
      for (let i = 0; i < content.reading2.gapFill.questions.length; i++) {
        gapSentence(26 + i, content.reading2.gapFill.questions[i].sentence);
      }

      // ────────────────────────────────────────────────────────────
      // TASKS 3 & 4 — WRITING
      // ────────────────────────────────────────────────────────────
      const writingSection = (
        taskNum: number,
        taskTitle: string,
        task: WrittenExamContent["readingIntoWriting"],
      ) => {
        addPage();
        taskHeader(taskNum, taskTitle);

        // Prompt box
        font(9, "normal");
        const promptLines = doc.splitTextToSize(task.prompt, TW - 6) as string[];
        const bpBlocks: string[][] = (task.bulletPoints ?? []).map(bp => {
          font(9, "normal");
          return doc.splitTextToSize(`•  ${bp}`, TW - 10) as string[];
        });
        let promptBoxH = 10 + promptLines.length * 5;
        if (bpBlocks.length) promptBoxH += bpBlocks.reduce((a, b) => a + b.length * 5, 0) + 6;
        promptBoxH += 6;

        borderBox(ML, y, TW, promptBoxH);
        doc.setTextColor(0);
        let py = y + 7;
        font(9, "normal");
        for (const pl of promptLines) { doc.text(pl, ML + 4, py); py += 5; }
        if (bpBlocks.length) {
          py += 3;
          for (const bl of bpBlocks) { for (const ln of bl) { doc.text(ln, ML + 8, py); py += 5; } }
        }
        y += promptBoxH + 5;

        font(8, "italic");
        gray(70);
        doc.text("Do not copy from the texts. Write in your own words.", ML, y);
        doc.setTextColor(0);
        y += 6;

        font(8.5, "bold");
        doc.setTextColor(0);
        doc.text(`Word limit: ${task.wordLimit.min}–${task.wordLimit.max} words`, ML, y);
        y += 9;

        check(50);
        font(8.5, "normal");
        doc.setTextColor(0);
        doc.text("Planning notes  (not assessed):", ML, y);
        y += 4;
        borderBox(ML, y, TW, 38);
        y += 44;

        font(8.5, "bold");
        doc.setTextColor(0);
        doc.text("Your answer:", ML, y);
        y += 6;

        // Writing lines page 1
        const LS = 9;
        while (y + LS <= FOOT_Y) { dottedLine(ML, y, W - MR); y += LS; }

        // Writing lines page 2
        addPage();
        while (y + LS <= FOOT_Y - 14) { dottedLine(ML, y, W - MR); y += LS; }
        y += 6;
        font(8.5, "normal");
        doc.setTextColor(0);
        doc.text("Word count:", ML, y);
        dottedLine(ML + 26, y, ML + 76);
      };

      writingSection(3, "Reading into Writing", content.readingIntoWriting);
      writingSection(4, "Extended Writing", content.extendedWriting);

      // ────────────────────────────────────────────────────────────
      // PAGE FOOTERS
      // ────────────────────────────────────────────────────────────
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const isLast = p === total;

        if (!isLast) {
          font(14, "bold");
          doc.setTextColor(0);
          doc.text("Turn over page", W / 2, H - 11, { align: "center" });
        } else {
          font(16, "bold");
          doc.setTextColor(0);
          doc.text("End of exam", W / 2, H - 14, { align: "center" });
        }

        font(7.5, "normal");
        gray(120);
        doc.text(`page ${p}`, ML, H - 5);
        doc.text(
          "This exam paper has four tasks. Complete all tasks.",
          W - MR, H - 5, { align: "right" }
        );
        doc.setTextColor(0);
      }

      doc.save(`ISE_${(LEVEL_LABELS[level] ?? level).replace(/\s/g, "_")}_${examId.slice(-6)}.pdf`);

    } catch (err) {
      console.error("[pdf]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {loading ? "Generating PDF..." : "Download as PDF"}
    </Button>
  );
}
