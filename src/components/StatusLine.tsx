import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type Tone = "ok" | "warn" | "danger";

const ICON: Record<Tone, IconName> = { ok: "check", warn: "alert", danger: "x" };
const COLOR: Record<Tone, string> = {
  ok: "text-status-ok border-status-ok",
  warn: "text-status-warn border-status-warn",
  danger: "text-status-danger border-status-danger",
};

// Status is never color-only: the icon and the title text carry the meaning on their own.
export function StatusLine({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div className={`border-l-4 bg-surface px-4 py-3 ${COLOR[tone]}`}>
      <p className="flex items-center gap-2 font-bold">
        <Icon name={ICON[tone]} />
        {title}
      </p>
      {children ? <div className="mt-1 text-text">{children}</div> : null}
    </div>
  );
}
