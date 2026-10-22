import { describe, expect, it } from "vitest";
import { formatSeoul } from "./format.ts";

describe("formatSeoul", () => {
  it("shows Seoul time as yyyy-MM-dd HH:mm", () => {
    expect(formatSeoul("2026-10-20T00:30:00Z")).toBe("2026-10-20 09:30");
  });

  it("rolls over to the next day in Seoul", () => {
    expect(formatSeoul("2026-10-20T15:05:00Z")).toBe("2026-10-21 00:05");
  });
});
