import { describe, expect, it } from "vitest";
import { getRules } from "./rules.ts";

describe("getRules", () => {
  it("loads and validates the current rules file", () => {
    const rules = getRules();
    expect(rules.version).toBe("v1");
    expect(rules.eligibility.revisitWindowDays).toBeGreaterThan(0);
  });

  it("lists the placeholder values it contains", () => {
    expect(getRules().assumptions.length).toBeGreaterThan(0);
  });
});
