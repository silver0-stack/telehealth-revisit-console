// A handful of line icons drawn by hand, so status never relies on keyboard glyphs (○ ✓ ⚠) that render
// differently per font. Seven icons do not justify an icon library. Every icon is decorative:
// the text next to it carries the meaning (status is never shown by icon or color alone).

export type IconName = "check" | "alert" | "x" | "pending" | "pause" | "arrow-left" | "arrow-right";

const PATHS: Record<IconName, string> = {
  check: "M4 10.5l4 4 8-9",
  alert: "M10 3.5L2.5 16.5h15L10 3.5zM10 8.5v3.5M10 14.4v.1",
  x: "M5 5l10 10M15 5L5 15",
  pending: "M10 3.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z",
  pause: "M7.5 5v10M12.5 5v10",
  "arrow-left": "M16 10H4M9 5l-5 5 5 5",
  "arrow-right": "M4 10h12M11 5l5 5-5 5",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`inline-block h-[1em] w-[1em] flex-none align-[-0.125em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
