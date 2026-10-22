import { describe, expect, it } from "vitest";
import { checkEligibility, type EligibilityInput } from "./eligibility.ts";
import type { Rules } from "./rules.ts";
import type { Visit } from "./types.ts";

// Tests use their own rules object so they do not change when config/rules is edited.
const rules: Rules = { version: "test-v1", assumptions: [], eligibility: { revisitWindowDays: 30 } };

let nextId = 1;
function visit(date: string, overrides: Partial<Visit> = {}): Visit {
  return {
    id: `V-${String(nextId++).padStart(5, "0")}`,
    patientId: "P-0001",
    date,
    mode: "in_person",
    kcdCode: "J02.9",
    note: "인후통",
    ...overrides,
  };
}

function input(visits: Visit[], overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    patientId: "P-0001",
    requestedAt: "2026-10-20T10:00:00+09:00",
    symptomKcdCode: "J02.9",
    visits,
    ...overrides,
  };
}

describe("checkEligibility", () => {
  describe("window boundary", () => {
    it("is eligible when the in-person visit is exactly on the boundary day (30 days ago)", () => {
      const v = visit("2026-09-20");
      expect(checkEligibility(input([v]), rules)).toEqual({
        eligible: true,
        reason: "IN_PERSON_VISIT_WITHIN_WINDOW",
        ruleVersion: "test-v1",
        evidenceVisitId: v.id,
      });
    });

    it("is not eligible one day past the boundary (31 days ago)", () => {
      const result = checkEligibility(input([visit("2026-09-19")]), rules);
      expect(result).toMatchObject({ eligible: false, reason: "OUTSIDE_WINDOW", evidenceVisitId: null });
    });

    it("counts a visit on the same day as the request", () => {
      expect(checkEligibility(input([visit("2026-10-20")]), rules).eligible).toBe(true);
    });

    it("uses the window from the rules, not a fixed number", () => {
      const v = visit("2026-10-10"); // 10 days ago
      expect(checkEligibility(input([v]), rules).eligible).toBe(true);
      const strict: Rules = { ...rules, version: "test-v2", eligibility: { revisitWindowDays: 7 } };
      expect(checkEligibility(input([v]), strict)).toMatchObject({
        eligible: false,
        reason: "OUTSIDE_WINDOW",
        ruleVersion: "test-v2",
      });
    });

    it("decides the request day in Seoul time, not UTC", () => {
      // 2026-10-19T16:00Z is already 2026-10-20 in Seoul, so 2026-09-20 is exactly 30 days earlier.
      const result = checkEligibility(input([visit("2026-09-20")], { requestedAt: "2026-10-19T16:00:00Z" }), rules);
      expect(result.eligible).toBe(true);
    });
  });

  describe("missing or unusable visits", () => {
    it("is not eligible with no visits at all", () => {
      expect(checkEligibility(input([]), rules)).toMatchObject({ eligible: false, reason: "NO_VISIT" });
    });

    it("is not eligible when the only visits are telehealth, even for the same symptom inside the window", () => {
      const visits = [visit("2026-10-15", { mode: "telehealth" }), visit("2026-10-01", { mode: "telehealth" })];
      expect(checkEligibility(input(visits), rules)).toMatchObject({
        eligible: false,
        reason: "ONLY_TELEHEALTH_VISITS",
        evidenceVisitId: null,
      });
    });

    it("is not eligible when the in-person visit was for a different symptom", () => {
      const result = checkEligibility(input([visit("2026-10-15", { kcdCode: "M54.5" })]), rules);
      expect(result).toMatchObject({ eligible: false, reason: "NO_MATCHING_SYMPTOM" });
    });

    it("ignores visits dated after the request", () => {
      const result = checkEligibility(input([visit("2026-10-21")]), rules);
      expect(result).toMatchObject({ eligible: false, reason: "NO_VISIT" });
    });

    it("ignores another patient's visits", () => {
      const result = checkEligibility(input([visit("2026-10-15", { patientId: "P-0002" })]), rules);
      expect(result).toMatchObject({ eligible: false, reason: "NO_VISIT" });
    });
  });

  describe("several visits", () => {
    it("uses the most recent matching in-person visit as evidence", () => {
      const older = visit("2026-09-25");
      const newer = visit("2026-10-12");
      const result = checkEligibility(input([older, newer]), rules);
      expect(result).toMatchObject({ eligible: true, evidenceVisitId: newer.id });
    });

    it("skips newer telehealth and different-symptom visits to find the qualifying one", () => {
      const qualifying = visit("2026-09-30");
      const visits = [
        visit("2026-10-18", { mode: "telehealth" }),
        visit("2026-10-16", { kcdCode: "K21.9" }),
        qualifying,
        visit("2026-08-01"), // same symptom but outside the window
      ];
      expect(checkEligibility(input(visits), rules)).toMatchObject({
        eligible: true,
        evidenceVisitId: qualifying.id,
      });
    });

    it("is not eligible when every matching in-person visit is outside the window", () => {
      const visits = [visit("2026-08-01"), visit("2026-07-01"), visit("2026-10-15", { mode: "telehealth" })];
      expect(checkEligibility(input(visits), rules)).toMatchObject({ eligible: false, reason: "OUTSIDE_WINDOW" });
    });
  });
});
