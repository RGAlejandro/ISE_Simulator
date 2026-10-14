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

      const taskHeader = (num: number, name: string, duration?: string) => {
        font(11, "bold");
        doc.setTextColor(0);
        doc.text(`Task ${num}  —  ${name}`, ML, y);
        if (duration) {
          font(9, "italic");
          gray(90);
          doc.text(duration, W - MR, y, { align: "right" });
          doc.setTextColor(0);
        }
        y += 5;
        solidLine(ML, y, W - MR);
        y += 8;
      };

      const endOfTask = (num: number) => {
        y += 4;
        font(9, "bold");
        gray(80);
        const label = `— END OF TASK ${num} —`;
        doc.text(label, W / 2, y, { align: "center" });
        doc.setTextColor(0);
        y += 6;
      };

      const qHeader = (title: string, instr: string) => {
        check(14);
        font(9.5, "bold");
        doc.setTextColor(0);
        doc.text(title, ML, y);
        y += 5;
        font(8.5, "normal");
        const lines = doc.splitTextToSize(instr, TW) as string[];
        for (const ln of lines) { doc.text(ln, ML, y); y += 4; }
        y += 4;
      };

      // ── Two-column section: answer blanks LEFT, bordered options box RIGHT ──
      const twoColSection = (
        leftItems: { num: number; label?: string }[],
        rightTitle: string,
        rightRows: { key: string; lines: string[] }[],
        leftColW: number,
      ) => {
        const ROW_LH = 4.2;
        const ROW_PAD = 1.4;
        let boxH = 7.5;
        for (const r of rightRows) {
          boxH += Math.max(r.lines.length, 1) * ROW_LH + ROW_PAD;
        }

        const RX = ML + leftColW + 4;
        const RC = TW - leftColW - 4;

        check(boxH + 3);
        const top = y;
        const ANS_LH = boxH / Math.max(leftItems.length, 1);

        // Left column: answer blanks
        for (let i = 0; i < leftItems.length; i++) {
          const ay = top + i * ANS_LH + ANS_LH / 2 + 1;
          font(8.5, "normal");
          doc.setTextColor(0);
          doc.text(`${leftItems[i].num}`, ML, ay);
          if (leftItems[i].label) {
            font(8, "italic");
            gray(60);
            doc.text(leftItems[i].label!, ML + 6, ay);
            doc.setTextColor(0);
            font(8.5, "normal");
            dottedLine(ML + 6 + doc.getTextWidth(leftItems[i].label!) + 3, ay, ML + leftColW - 2);
          } else {
            dottedLine(ML + 7, ay, ML + leftColW - 2);
          }
        }

        // Right column: bordered box
        borderBox(RX, top, RC, boxH);
        font(7.5, "bold");
        doc.setTextColor(0);
        doc.text(rightTitle, RX + 3, top + 5);
        lw(0.25);
        doc.setDrawColor(0);
        doc.line(RX, top + 6.5, RX + RC, top + 6.5);

        let oy = top + 6.5 + ROW_LH;
        for (const row of rightRows) {
          font(8.5, "bold");
          doc.setTextColor(0);
          doc.text(row.key, RX + 3, oy);
          font(8.5, "normal");
          for (const ln of row.lines) {
            doc.text(ln, RX + 9.5, oy);
            oy += ROW_LH;
          }
          if (row.lines.length === 0) oy += ROW_LH;
          oy += ROW_PAD;
        }
        y = top + boxH + 8;
      };

      // ── Inline gap-fill sentence ──
      const gapSentence = (num: number, sentence: string) => {
        const GAP_W = 26;
        const LH = 4.3;
        const TRAIL = 4;
        const parts = sentence.split("_______");
        const before = `${num}   ${(parts[0] ?? "").trim()}`;
        const after = (parts[1] ?? "").trim();

        check(LH + TRAIL);
        font(8.5, "normal");
        doc.setTextColor(0);

        const prefixW = doc.getTextWidth(before);
        const afterW = after ? doc.getTextWidth(after) : 0;

        if (prefixW + GAP_W + 4 + afterW <= TW) {
          doc.text(before, ML, y);
          const gx = ML + prefixW + 3;
          dottedLine(gx, y, gx + GAP_W);
          if (after) doc.text(after, gx + GAP_W + 3, y);
          y += LH + TRAIL;
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
              y += LH + TRAIL;
            } else {
              y += LH;
              const afterLines = doc.splitTextToSize(after, TW) as string[];
              for (const al of afterLines) { check(LH); doc.text(al, ML, y); y += LH; }
              y += TRAIL;
            }
          } else {
            y += LH + TRAIL;
          }
        }
      };

      // ── Trinity "Notes" boxed gap-fill (Q26-30) with optional title + section headings ──
      const renderNotesBox = (section: WrittenExamContent["reading2"]["gapFill"], startN: number) => {
        const PAD_X = 6;
        const PAD_Y = 5;
        const GAP_W = 26;
        const LINE_H = 4.5;
        const ITEM_GAP = 2.5;
        const HEAD_GAP_BEFORE = 4;
        const HEAD_GAP_AFTER = 2;
        const NOTES_HEADER_H = 6;
        const TITLE_H = 6;
        const BULLET_X_OFFSET = 3;
        const TEXT_INDENT = 8;
        const TEXT_W = TW - PAD_X * 2 - TEXT_INDENT;

        // Group questions by sectionHeading (consecutive same heading)
        const groups: { heading: string | null; items: { num: number; sentence: string }[] }[] = [];
        let cur: string | null | undefined;
        for (let i = 0; i < section.questions.length; i++) {
          const q = section.questions[i];
          const h = q.sectionHeading ?? null;
          if (groups.length === 0 || h !== cur) {
            groups.push({ heading: h, items: [] });
            cur = h;
          }
          groups[groups.length - 1].items.push({ num: startN + i, sentence: q.sentence });
        }

        // Helper: measure sentence height (lines × LINE_H)
        const measureItem = (num: number, sentence: string): number => {
          const parts = sentence.split("_______");
          const before = `(${num}.)  ${(parts[0] ?? "").trim()}`;
          const after = (parts[1] ?? "").trim();
          font(8.5, "normal");
          const beforeW = doc.getTextWidth(before);
          const afterW = after ? doc.getTextWidth(after) : 0;
          if (beforeW + GAP_W + 3 + afterW <= TEXT_W) return LINE_H;
          const beforeLines = doc.splitTextToSize(before, TEXT_W - GAP_W - 8) as string[];
          let h = beforeLines.length * LINE_H;
          const lastW = doc.getTextWidth(beforeLines[beforeLines.length - 1]);
          if (after && lastW + GAP_W + 3 + afterW > TEXT_W) {
            const afterLines = doc.splitTextToSize(after, TEXT_W) as string[];
            h += afterLines.length * LINE_H;
          }
          return h;
        };

        // Pre-compute box height
        let boxH = PAD_Y * 2 + NOTES_HEADER_H;
        if (section.notesTitle) boxH += TITLE_H;
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi];
          if (g.heading) boxH += HEAD_GAP_BEFORE + 4.5 + HEAD_GAP_AFTER;
          for (let ii = 0; ii < g.items.length; ii++) {
            boxH += measureItem(g.items[ii].num, g.items[ii].sentence);
            if (ii < g.items.length - 1) boxH += ITEM_GAP;
          }
        }

        check(boxH + 4);

        // Draw shaded box
        doc.setFillColor(248, 248, 250);
        doc.setDrawColor(170, 170, 170);
        lw(0.3);
        doc.rect(ML, y, TW, boxH, "FD");

        let py = y + PAD_Y;
        const baseX = ML + PAD_X;

        // "Notes" header
        font(9.5, "bold");
        doc.setTextColor(0);
        doc.text("Notes", baseX, py + 3.5);
        py += NOTES_HEADER_H;

        // Notes title (overall topic)
        if (section.notesTitle) {
          font(9, "bold");
          doc.text(section.notesTitle, baseX, py + 3.5);
          py += TITLE_H;
        }

        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi];
          if (g.heading) {
            py += HEAD_GAP_BEFORE;
            font(8.8, "bold");
            doc.setTextColor(0);
            doc.text(g.heading, baseX, py + 3);
            py += 4.5 + HEAD_GAP_AFTER;
          }

          for (let ii = 0; ii < g.items.length; ii++) {
            const it = g.items[ii];
            const parts = it.sentence.split("_______");
            const before = `(${it.num}.)  ${(parts[0] ?? "").trim()}`;
            const after = (parts[1] ?? "").trim();

            font(8.5, "normal");
            doc.setTextColor(0);
            // Bullet
            doc.text("•", baseX + BULLET_X_OFFSET, py + 3);

            const textX = baseX + TEXT_INDENT;
            const beforeW = doc.getTextWidth(before);
            const afterW = after ? doc.getTextWidth(after) : 0;

            if (beforeW + GAP_W + 3 + afterW <= TEXT_W) {
              doc.text(before, textX, py + 3);
              const gx = textX + beforeW + 3;
              dottedLine(gx, py + 3, gx + GAP_W);
              if (after) doc.text(after, gx + GAP_W + 3, py + 3);
              py += LINE_H;
            } else {
              const beforeLines = doc.splitTextToSize(before, TEXT_W - GAP_W - 8) as string[];
              for (let bi = 0; bi < beforeLines.length - 1; bi++) {
                doc.text(beforeLines[bi], textX, py + 3);
                py += LINE_H;
              }
              const lastLine = beforeLines[beforeLines.length - 1];
              doc.text(lastLine, textX, py + 3);
              const lastW = doc.getTextWidth(lastLine);
              const gx = textX + lastW + 3;
              dottedLine(gx, py + 3, gx + GAP_W);
              if (after) {
                const remaining = ML + TW - PAD_X - gx - GAP_W - 4;
                if (remaining > 10 && afterW <= remaining) {
                  doc.text(after, gx + GAP_W + 3, py + 3);
                  py += LINE_H;
                } else {
                  py += LINE_H;
                  const afterLines = doc.splitTextToSize(after, TEXT_W) as string[];
                  for (const al of afterLines) { doc.text(al, textX, py + 3); py += LINE_H; }
                }
              } else {
                py += LINE_H;
              }
            }
            if (ii < g.items.length - 1) py += ITEM_GAP;
          }
        }

        y += boxH + 6;
      };

      // ────────────────────────────────────────────────────────────
      // COVER PAGE
      // ────────────────────────────────────────────────────────────
      // Top branding strip
      font(8, "normal");
      gray(110);
      doc.text("Trinity College London", ML, 11);
      doc.text("Reading & Writing exam — Sample Paper", W - MR, 11, { align: "right" });
      solidLine(ML, 13.5, W - MR, 0.4);

      y = 36;
      font(11, "normal");
      gray(80);
      doc.text("INTEGRATED SKILLS IN ENGLISH", ML, y);
      doc.setTextColor(0);
      y += 14;

      font(30, "bold");
      doc.text(levelLabel, ML, y);
      y += 13;

      font(14, "normal");
      gray(60);
      doc.text("Reading & Writing exam", ML, y);
      doc.setTextColor(0);
      y += 14;

      solidLine(ML, y, W - MR, 0.5);
      y += 10;

      // Time allowed — prominent
      font(10, "bold");
      doc.setTextColor(0);
      doc.text("Time allowed", ML, y);
      font(11, "normal");
      doc.text("2 hours", ML + 40, y);
      y += 16;

      // Candidate info — labeled dotted underlines
      font(9, "bold");
      doc.text("CANDIDATE DETAILS", ML, y);
      y += 6;
      font(8.5, "normal");
      doc.text("Candidate name", ML, y);
      y += 5;
      dottedLine(ML, y, ML + TW);
      y += 12;

      doc.text("Centre number", ML, y);
      doc.text("Candidate number", ML + TW / 2, y);
      y += 5;
      dottedLine(ML, y, ML + TW / 2 - 8);
      dottedLine(ML + TW / 2, y, ML + TW);
      y += 12;

      doc.text("Date of exam", ML, y);
      doc.text("Signature", ML + TW / 2, y);
      y += 5;
      dottedLine(ML, y, ML + TW / 2 - 8);
      dottedLine(ML + TW / 2, y, ML + TW);
      y += 14;

      // Materials required + Instructions split into two boxes side-by-side
      const matItems = [
        "Blue or black ink pen",
        "Pencil (for planning notes only)",
      ];
      const colW = (TW - 6) / 2;
      const matH = matItems.length * 5 + 13;

      font(9, "bold");
      doc.setTextColor(0);
      doc.text("Materials required", ML, y);
      borderBox(ML, y + 3, colW, matH);
      font(9, "normal");
      let mi = y + 10;
      for (const item of matItems) {
        doc.text("•", ML + 4, mi);
        doc.text(item, ML + 9, mi);
        mi += 5;
      }

      // Right column: Information
      const rightX = ML + colW + 6;
      font(9, "bold");
      doc.text("Information for candidates", rightX, y);
      borderBox(rightX, y + 3, colW, matH);
      font(8.5, "normal");
      const infoLines = [
        "This exam paper has four tasks.",
        "Complete all tasks.",
        `Total marks: 30 (Reading) + 30 (Writing).`,
      ];
      let ri = y + 10;
      for (const ln of infoLines) {
        const wrapped = doc.splitTextToSize(ln, colW - 8) as string[];
        for (const w of wrapped) { doc.text(w, rightX + 4, ri); ri += 5; }
      }
      y += matH + 11;

      // Instructions to candidates
      const instrItems = [
        "Write your name, candidate number and centre on this front cover.",
        "Do not open this exam paper until instructed to do so.",
        "Use blue or black pen, not pencil, for all your answers.",
        "Write your answers in the spaces provided on the exam paper.",
        "Do all rough work on the exam paper. Cross through anything you do not want marked.",
        "Dictionaries and correction fluid are not permitted.",
        "You are advised to spend approximately 20 minutes on Task 1, 20 minutes on Task 2, 40 minutes on Task 3, and 40 minutes on Task 4.",
      ];
      font(9, "bold");
      doc.setTextColor(0);
      doc.text("Instructions to candidates", ML, y);
      y += 4;
      font(9, "normal");
      let iy = y + 3;
      for (let i = 0; i < instrItems.length; i++) {
        const wrapped = doc.splitTextToSize(instrItems[i], TW - 10) as string[];
        font(9, "bold");
        doc.text(`${i + 1}.`, ML, iy);
        font(9, "normal");
        for (const w of wrapped) { doc.text(w, ML + 6, iy); iy += 5; }
        iy += 1;
      }
      y = iy + 4;

      // Paper code footer
      font(7.5, "normal");
      gray(120);
      const paperCode = `${level.replace("ISE_", "ISE-")}-RW-${examId.slice(-4).toUpperCase()}`;
      doc.text(paperCode, ML, H - 14);
      doc.text("© Trinity College London — Sample paper", W - MR, H - 14, { align: "right" });
      doc.setTextColor(0);

      // ────────────────────────────────────────────────────────────
      // TASK 1 — LONG READING
      // ────────────────────────────────────────────────────────────

      // Pre-compute paragraph box BEFORE drawing anything so we never create an empty page.
      // If the box is very tall it will simply overflow the page bottom (rare edge case).
      const T1_BOX_PAD_X = 5, T1_BOX_PAD_Y = 4, T1_LABEL_FONT = 9, T1_BODY_FONT = 8.2;
      const T1_LABEL_H = 4.5, T1_LINE_H = 3.9, T1_PARA_GAP = 2.8;
      const T1_TEXT_W = TW - T1_BOX_PAD_X * 2;
      font(T1_BODY_FONT, "normal");
      const t1RenderedParas = content.reading1.paragraphs.map(p => ({
        label: `Paragraph ${p.number}`,
        lines: doc.splitTextToSize(p.text, T1_TEXT_W) as string[],
      }));
      let t1BoxH = T1_BOX_PAD_Y * 2;
      for (let i = 0; i < t1RenderedParas.length; i++) {
        t1BoxH += T1_LABEL_H + t1RenderedParas[i].lines.length * T1_LINE_H;
        if (i < t1RenderedParas.length - 1) t1BoxH += T1_PARA_GAP;
      }

      addPage(true);
      taskHeader(1, "Long reading", "Suggested time: 20 minutes  ·  15 marks");

      // Intro w/ topic embedded
      font(9, "normal");
      doc.setTextColor(0);
      const t1intro = `Read the following text about ${content.reading1.title} and answer the 15 questions on the next page.`;
      const t1introLines = doc.splitTextToSize(t1intro, TW) as string[];
      for (const ln of t1introLines) { doc.text(ln, ML, y); y += 5; }
      y += 5;

      // Draw paragraph box (dimensions pre-computed above — no overflow check needed)
      {
        doc.setFillColor(244, 244, 246);
        doc.setDrawColor(180, 180, 180);
        lw(0.3);
        doc.rect(ML, y, TW, t1BoxH, "FD");

        let py = y + T1_BOX_PAD_Y;
        for (let i = 0; i < t1RenderedParas.length; i++) {
          const { label, lines } = t1RenderedParas[i];
          font(T1_LABEL_FONT, "bold");
          doc.setTextColor(0);
          doc.text(label, ML + T1_BOX_PAD_X, py + 3.3);
          py += T1_LABEL_H;

          font(T1_BODY_FONT, "normal");
          for (const ln of lines) {
            doc.text(ln, ML + T1_BOX_PAD_X, py + 3);
            py += T1_LINE_H;
          }
          if (i < t1RenderedParas.length - 1) py += T1_PARA_GAP;
        }

        y += t1BoxH + 6;
      }

      // Questions always start on a fresh page (reading text on one side, answers on the other)
      addPage();

      // Q1–5 paragraph matching
      qHeader(
        "Questions 1–5",
        "The text on page 2 has five paragraphs (1–5). Choose the best title for each paragraph from A–F below and write the letter (A–F) on the lines below. There is one more title than you need.",
      );
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
      qHeader(
        "Questions 6–10",
        "Choose the five statements from A–H below that are TRUE according to the information given in the text on page 2. Write the letters of the TRUE statements on the lines below (in any order).",
      );
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
      qHeader(
        "Questions 11–15",
        "Complete sentences 11–15 with an exact number, word or phrase (maximum three words) from the text. Write the exact number, word or phrase on the lines below.",
      );
      for (let i = 0; i < content.reading1.gapFill.questions.length; i++) {
        gapSentence(11 + i, content.reading1.gapFill.questions[i].sentence);
      }

      // ────────────────────────────────────────────────────────────
      // TASK 2 — MULTI-TEXT READING
      // ────────────────────────────────────────────────────────────
      endOfTask(1);
      addPage();
      taskHeader(2, "Multi-text reading", "Suggested time: 20 minutes  ·  15 marks");

      font(9, "normal");
      doc.setTextColor(0);
      const t2intro = `In this section there are four short texts for you to read and some questions for you to answer.`;
      const t2introLines = doc.splitTextToSize(t2intro, TW) as string[];
      for (const ln of t2introLines) { doc.text(ln, ML, y); y += 5; }
      y += 4;

      // Q16–20 FIRST — text matching with right-margin blank
      qHeader(
        "Questions 16–20",
        "Read questions 16–20 first and then read texts A, B, C and D below the questions. As you read each text, decide which text each question refers to. Choose one letter — A, B, C or D — and write it on the lines below. You can use any letter more than once.",
      );
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

      // Bar chart renderer (for graph-type texts)
      const drawBarChart = (
        bx: number, by: number, bw: number, bh: number,
        data: { label: string; value: number }[],
      ) => {
        const PAD_L = 14;
        const PAD_R = 6;
        const PAD_T = 8;
        const PAD_B = 12;
        const chartLeft = bx + PAD_L;
        const chartRight = bx + bw - PAD_R;
        const chartTop = by + PAD_T;
        const chartBottom = by + bh - PAD_B;
        const chartW = chartRight - chartLeft;
        const chartH = chartBottom - chartTop;

        const max = Math.max(...data.map(d => d.value), 1);
        const niceMax = Math.ceil(max / 10) * 10 || 10;

        // Y-axis ticks + horizontal gridlines
        const tickCount = 4;
        for (let i = 0; i <= tickCount; i++) {
          const val = (niceMax * i) / tickCount;
          const ty = chartBottom - (chartH * i) / tickCount;
          doc.setDrawColor(220, 220, 220);
          lw(0.15);
          doc.line(chartLeft, ty, chartRight, ty);
          font(6.5, "normal");
          gray(120);
          doc.text(String(Math.round(val)), chartLeft - 1.5, ty + 1, { align: "right" });
        }
        doc.setTextColor(0);

        // Bars
        const slotW = chartW / data.length;
        const barW = slotW * 0.55;
        const barOffset = (slotW - barW) / 2;

        doc.setFillColor(56, 102, 173);
        for (let i = 0; i < data.length; i++) {
          const barH = (data[i].value / niceMax) * chartH;
          const x = chartLeft + i * slotW + barOffset;
          const yBar = chartBottom - barH;
          doc.rect(x, yBar, barW, barH, "F");

          // Value above
          font(7, "bold");
          doc.setTextColor(0);
          doc.text(String(data[i].value), x + barW / 2, yBar - 1, { align: "center" });

          // Label below
          font(7, "normal");
          gray(60);
          doc.text(String(data[i].label), x + barW / 2, chartBottom + 4, { align: "center" });
        }
        doc.setTextColor(0);

        // X-axis line
        doc.setDrawColor(60, 60, 60);
        lw(0.35);
        doc.line(chartLeft, chartBottom, chartRight, chartBottom);
      };

      // Reusable text-block renderer
      const renderText = (t: typeof content.reading2.texts[number]) => {
        const HEADER_H = 5;
        const PAD_Y = 4;
        const LINE_H = 4.4;
        const BOTTOM_MARGIN = 8;

        // Header line above box — only "Text A/B/C/D"
        const writeHeader = () => {
          font(9.5, "bold");
          doc.setTextColor(0);
          doc.text(`Text ${t.letter}`, ML, y + 3.5);
          y += HEADER_H;
        };

        if (t.isGraph && t.graphData && t.graphData.length > 0) {
          // Chart layout: chart (fixed height) + description below
          const CHART_H = 70;
          font(8.8, "italic");
          const descLines = doc.splitTextToSize(t.content, TW - 8) as string[];
          const descH = descLines.length * LINE_H;
          const boxH = PAD_Y * 2 + CHART_H + 3 + descH;
          const totalH = HEADER_H + boxH + BOTTOM_MARGIN;

          check(totalH);
          writeHeader();
          borderBox(ML, y, TW, boxH);

          // Chart
          drawBarChart(ML, y + PAD_Y, TW, CHART_H, t.graphData);

          // Description below chart
          let ty = y + PAD_Y + CHART_H + 3 + 3;
          font(8.5, "italic");
          gray(70);
          for (const ln of descLines) { doc.text(ln, ML + 4, ty); ty += LINE_H; }
          doc.setTextColor(0);

          y += boxH + BOTTOM_MARGIN;
          return;
        }

        // Plain text layout
        font(8.8, "normal");
        const bodyLines = doc.splitTextToSize(t.content, TW - 8) as string[];
        const boxH = PAD_Y * 2 + bodyLines.length * LINE_H;
        const totalH = HEADER_H + boxH + BOTTOM_MARGIN;

        check(totalH);
        writeHeader();
        borderBox(ML, y, TW, boxH);
        font(8.8, "normal");
        let ty = y + PAD_Y + 3;
        for (const ln of bodyLines) { doc.text(ln, ML + 4, ty); ty += LINE_H; }
        y += boxH + BOTTOM_MARGIN;
      };

      // Texts A & B (same page as Q16-20)
      font(10, "bold");
      doc.setTextColor(0);
      doc.text("Texts", ML, y);
      y += 7;

      for (const t of content.reading2.texts.slice(0, 2)) renderText(t);

      // New page: Texts C & D + Q21-25
      addPage();
      for (const t of content.reading2.texts.slice(2)) renderText(t);
      y += 2;

      // Q21–25 statement selection (same page as texts C & D)
      qHeader(
        "Questions 21–25",
        "Choose the five statements from A–H below that are TRUE according to the information given in the texts above. Write the letters of the TRUE statements on the lines below (in any order).",
      );
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

      // New page: Q26–30 gap fill alone
      addPage();

      // Q26–30 gap fill — Trinity "Notes" structured box
      qHeader(
        "Questions 26–30",
        "The notes below contain information from the texts on pages 4 and 5. Find an exact number, word or phrase (maximum three words) from texts A–D to complete the missing information in gaps 26–30. Write the exact number, word or phrase on the lines below.",
      );
      renderNotesBox(content.reading2.gapFill, 26);
      endOfTask(2);

      // ────────────────────────────────────────────────────────────
      // TASKS 3 & 4 — WRITING
      // ────────────────────────────────────────────────────────────
      const writingSection = (
        taskNum: number,
        taskTitle: string,
        task: WrittenExamContent["readingIntoWriting"],
      ) => {
        addPage();
        taskHeader(taskNum, taskTitle, `Suggested time: 40 minutes  ·  ${task.wordLimit.min}–${task.wordLimit.max} words`);

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

        // Writing lines page 2 + review instruction
        addPage();
        while (y + LS <= FOOT_Y - 28) { dottedLine(ML, y, W - MR); y += LS; }
        y += 6;
        font(8.5, "normal");
        doc.setTextColor(0);
        doc.text("Word count:", ML, y);
        dottedLine(ML + 26, y, ML + 76);
        y += 12;
        font(8, "italic");
        gray(80);
        const reviewType = task.writingType ?? "writing";
        const reviewNote = `When you have finished your ${reviewType}, spend 2\u20133 minutes reading through what you have written. Make sure you have covered all the points and check your language and organisation.`;
        const reviewLines = doc.splitTextToSize(reviewNote, TW) as string[];
        for (const ln of reviewLines) { doc.text(ln, ML, y); y += 4.8; }
        doc.setTextColor(0);
      };

      writingSection(3, "Reading into writing", content.readingIntoWriting);
      endOfTask(3);
      writingSection(4, "Extended writing", content.extendedWriting);
      endOfTask(4);

      // ────────────────────────────────────────────────────────────
      // PAGE FOOTERS
      // ────────────────────────────────────────────────────────────
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const isLast = p === total;

        if (!isLast) {
          font(9, "italic");
          gray(100);
          doc.text("[ turn over ]", W - MR, H - 12, { align: "right" });
          doc.setTextColor(0);
        } else {
          font(13, "bold");
          doc.setTextColor(0);
          doc.text("— END OF EXAM —", W / 2, H - 13, { align: "center" });
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
