import { Fragment } from "react";

/**
 * Minimal, safe formatter for tutor replies: paragraphs, "- " bullet lists,
 * **bold** and *italic*. Builds React nodes — never injects HTML.
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const BULLET = /^\s*[-*•]\s+/;

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length > 0 && lines.every((l) => BULLET.test(l))) {
          return (
            <ul key={bi} className="space-y-1 pl-4 list-disc marker:text-zinc-400">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(BULLET, ""))}</li>)}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {BULLET.test(l) ? <>• {inline(l.replace(BULLET, ""))}</> : inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
