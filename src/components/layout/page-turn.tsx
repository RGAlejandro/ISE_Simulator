"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Sections in menu order. Moving to a section further right turns the page
 * forward (the new sheet comes in from the right); going back, from the left.
 * Pages inside the same section (Practice → an exam, a result…) just fade.
 */
const SECTIONS: string[][] = [
  ["/dashboard", "/exams"],
  ["/practice", "/exam", "/listening", "/writing", "/vocabulary", "/grammar", "/translation", "/pronunciation", "/official", "/results"],
  ["/readiness"],
  ["/chat"],
  ["/teams"],
  ["/tips"],
  ["/pricing"],
  ["/admin"],
];

function sectionOf(pathname: string): number {
  const i = SECTIONS.findIndex((group) => group.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  return i === -1 ? SECTIONS.length : i;
}

// Kept across navigations (the template remounts on every route change).
let lastPath: string | null = null;
let lastSection: number | null = null;
let lastClass = "";

function turnFor(pathname: string): string {
  // On the server this module is shared by every request: never animate there
  // (a first load doesn't turn a page) and keep the state browser-only.
  if (typeof window === "undefined") return "";
  // React may run this twice for the same render in development: answer the same.
  if (pathname === lastPath) return lastClass;
  const section = sectionOf(pathname);
  const cls = lastSection === null ? "" : section > lastSection ? "sheet-forward" : section < lastSection ? "sheet-back" : "sheet-fade";
  lastPath = pathname;
  lastSection = section;
  lastClass = cls;
  return cls;
}

export function PageTurn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [cls] = useState(() => turnFor(pathname));
  return <div className={`sheet ${cls}`}>{children}</div>;
}
