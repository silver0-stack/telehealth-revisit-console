import { describe, expect, it } from "vitest";
import { periodEnd, toSeoulDate } from "./dates.ts";

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

describe("periodEnd", () => {
  const sixMonths = { amount: 6, unit: "month" } as const;

  it("ends on the same day number six months later in an ordinary month", () => {
    expect(periodEnd("2026-04-20", sixMonths)).toBe("2026-10-20");
  });

  it("ends on the last day of the month when the visit was on a month's last day", () => {
    expect(periodEnd("2026-04-30", sixMonths)).toBe("2026-10-31");
  });

  it("clamps to the end of February when the matching day does not exist", () => {
    expect(periodEnd("2026-08-31", sixMonths)).toBe("2027-02-28");
    expect(periodEnd("2027-08-31", sixMonths)).toBe("2028-02-29"); // leap year
  });

  it("crosses a year boundary", () => {
    expect(periodEnd("2026-12-15", sixMonths)).toBe("2027-06-15");
  });

  it("counts day periods without the start day", () => {
    expect(periodEnd("2026-09-20", { amount: 30, unit: "day" })).toBe("2026-10-20");
  });
});
