import { describe, expect, it } from "vitest";
import { toSeoulDate } from "./dates.ts";

describe("toSeoulDate", () => {
  it("keeps the date of a +09:00 timestamp", () => {
    expect(toSeoulDate("2026-10-20T00:30:00+09:00")).toBe("2026-10-20");
    expect(toSeoulDate("2026-10-20T23:59:00+09:00")).toBe("2026-10-20");
  });

  it("moves a late-UTC timestamp to the next Seoul day", () => {
    expect(toSeoulDate("2026-10-19T16:00:00Z")).toBe("2026-10-20");
    expect(toSeoulDate("2026-10-19T14:59:59Z")).toBe("2026-10-19");
  });

  it("throws on garbage instead of returning a wrong date", () => {
    expect(() => toSeoulDate("not a date")).toThrow();
  });
});
