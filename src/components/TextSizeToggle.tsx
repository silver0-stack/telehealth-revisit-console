"use client";

import { useState } from "react";

// Not persisted on purpose: the demo has no user accounts yet.
export function TextSizeToggle() {
  const [large, setLarge] = useState(false);

  function toggle() {
    const next = !large;
    setLarge(next);
    if (next) document.documentElement.dataset.textSize = "large";
    else delete document.documentElement.dataset.textSize;
  }

  return (
    <button
      type="button"
      aria-pressed={large}
      onClick={toggle}
      className="rounded border border-border bg-surface px-3 py-1 text-text hover:border-accent"
    >
      {/* A small and a large "가" side by side is the common Korean icon for text size. */}
      <span aria-hidden="true" className="mr-1.5 font-bold">
        <span className="text-sm">가</span>
        <span className="text-lg">가</span>
      </span>
      큰 글씨 {large ? "켜짐" : "꺼짐"}
    </button>
  );
}
