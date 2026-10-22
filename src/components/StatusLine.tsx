import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "danger";

const ICON: Record<Tone, string> = { ok: "✓", warn: "!", danger: "✕" };
const COLOR: Record<Tone, string> = {
  ok: "text-status-ok border-status-ok",
  warn: "text-status-warn border-status-warn",
  danger: "text-status-danger border-status-danger",
};

// Status is never color-only: the icon and the title text carry the meaning on their own.
export function StatusLine({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div className={`border-l-4 bg-surface px-4 py-3 ${COLOR[tone]}`}>
      <p className="font-bold">
        <span aria-hidden="true" className="mr-2 inline-block w-4 text-center">
          {ICON[tone]}
        </span>
        {title}
      </p>
      {children ? <div className="mt-1 text-text">{children}</div> : null}
    </div>
  );
}
