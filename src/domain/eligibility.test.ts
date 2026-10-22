import { describe, expect, it } from "vitest";
import { checkEligibility, type EligibilityInput } from "./eligibility.ts";
import type { Rules } from "./rules.ts";
import type { Visit } from "./types.ts";

// Tests use their own rules objects so they do not change when config/rules is edited.
const draftRules: Rules = {
  version: "test-draft",
  source: "test",
  assumptions: [],
  followUp: { window: { amount: 6, unit: "month" } },
  firstVisit: { requireSameRegion: true, outsideRegionExceptions: ["rare_disease"] },
};

const legacyRules: Rules = {
  version: "test-legacy",
  source: "test",
  assumptions: [],
  followUp: { window: { amount: 30, unit: "day" } },
  firstVisit: { requireSameRegion: false, outsideRegionExceptions: [] },
};

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
    patient: { id: "P-0001", region: "서울특별시", telehealthException: null },
    clinicRegion: "서울특별시",
    requestedAt: "2026-10-20T10:00:00+09:00",
    symptomKcdCode: "J02.9",
    visits,
    ...overrides,
  };
}

const outOfRegionPatient = { id: "P-0001", region: "부산광역시", telehealthException: null } as const;

describe("checkEligibility: follow-up (일반) window, 6 months", () => {
  it("is follow-up when the request is on the window's last day", () => {
    const v = visit("2026-04-20"); // window ends 2026-10-20
    expect(checkEligibility(input([v]), draftRules)).toEqual({
      kind: "follow_up",
      ruleVersion: "test-draft",
      evidenceVisitId: v.id,
      windowEnd: "2026-10-20",
    });
  });

  it("is not follow-up one day after the window ends", () => {
    const result = checkEligibility(input([visit("2026-04-19")]), draftRules); // ends 2026-10-19
    expect(result).toMatchObject({ kind: "first_visit", notFollowUp: "OUTSIDE_WINDOW" });
  });

  it("handles a visit on a month's last day (window runs to the end of the month)", () => {
    const v = visit("2026-04-30"); // window ends 2026-10-31
    const result = checkEligibility(input([v], { requestedAt: "2026-10-31T09:00:00+09:00" }), draftRules);
    expect(result).toMatchObject({ kind: "follow_up", windowEnd: "2026-10-31" });
  });

  it("counts a visit on the same day as the request", () => {
    expect(checkEligibility(input([visit("2026-10-20")]), draftRules).kind).toBe("follow_up");
  });

  it("decides the request day in Seoul time, not UTC", () => {
    // 2026-10-20T15:30Z is already 2026-10-21 in Seoul, one day past the window.
    const result = checkEligibility(input([visit("2026-04-20")], { requestedAt: "2026-10-20T15:30:00Z" }), draftRules);
    expect(result).toMatchObject({ kind: "first_visit", notFollowUp: "OUTSIDE_WINDOW" });
  });

  it("uses the window from the rules, not a fixed number", () => {
    const v = visit("2026-08-20"); // 2 months ago
    expect(checkEligibility(input([v]), draftRules).kind).toBe("follow_up");
    expect(checkEligibility(input([v]), legacyRules)).toMatchObject({
      kind: "first_visit",
      ruleVersion: "test-legacy",
      notFollowUp: "OUTSIDE_WINDOW",
    });
  });
});

describe("checkEligibility: why a request is not follow-up", () => {
  it("no visits at all", () => {
    expect(checkEligibility(input([]), draftRules)).toMatchObject({ notFollowUp: "NO_VISIT" });
  });

  it("only telehealth visits, even for the same symptom inside the window", () => {
    const visits = [visit("2026-10-15", { mode: "telehealth" }), visit("2026-10-01", { mode: "telehealth" })];
    expect(checkEligibility(input(visits), draftRules)).toMatchObject({
      kind: "first_visit",
      notFollowUp: "ONLY_TELEHEALTH_VISITS",
    });
  });

  it("an in-person visit for a different symptom", () => {
    const result = checkEligibility(input([visit("2026-10-15", { kcdCode: "M54.5" })]), draftRules);
    expect(result).toMatchObject({ kind: "first_visit", notFollowUp: "NO_MATCHING_SYMPTOM" });
  });

  it("ignores visits dated after the request", () => {
    expect(checkEligibility(input([visit("2026-10-21")]), draftRules)).toMatchObject({ notFollowUp: "NO_VISIT" });
  });

  it("ignores another patient's visits", () => {
    const result = checkEligibility(input([visit("2026-10-15", { patientId: "P-0002" })]), draftRules);
    expect(result).toMatchObject({ notFollowUp: "NO_VISIT" });
  });
});

describe("checkEligibility: several visits", () => {
  it("uses the most recent same-symptom in-person visit as evidence", () => {
    const older = visit("2026-06-01");
    const newer = visit("2026-09-12");
    expect(checkEligibility(input([older, newer]), draftRules)).toMatchObject({
      kind: "follow_up",
      evidenceVisitId: newer.id,
    });
  });

  it("skips newer telehealth and different-symptom visits", () => {
    const qualifying = visit("2026-07-30");
    const visits = [
      visit("2026-10-18", { mode: "telehealth" }),
      visit("2026-10-16", { kcdCode: "K21.9" }),
      qualifying,
      visit("2026-01-01"),
    ];
    expect(checkEligibility(input(visits), draftRules)).toMatchObject({ evidenceVisitId: qualifying.id });
  });

  it("is not follow-up when every same-symptom in-person visit is too old", () => {
    const visits = [visit("2026-03-01"), visit("2026-01-15"), visit("2026-10-15", { mode: "telehealth" })];
    expect(checkEligibility(input(visits), draftRules)).toMatchObject({ notFollowUp: "OUTSIDE_WINDOW" });
  });
});

describe("checkEligibility: first-visit (초진) region check", () => {
  it("allows first-visit telehealth in the same region", () => {
    expect(checkEligibility(input([]), draftRules)).toEqual({
      kind: "first_visit",
      ruleVersion: "test-draft",
      notFollowUp: "NO_VISIT",
      region: "SAME_REGION",
    });
  });

  it("refuses first-visit telehealth from another region", () => {
    expect(checkEligibility(input([], { patient: outOfRegionPatient }), draftRules)).toEqual({
      kind: "not_allowed",
      ruleVersion: "test-draft",
      notFollowUp: "NO_VISIT",
      region: "OUTSIDE_REGION",
    });
  });

  it("allows another region when the patient is in an exception category listed in the rules", () => {
    const patient = { ...outOfRegionPatient, telehealthException: "rare_disease" };
    expect(checkEligibility(input([], { patient }), draftRules)).toMatchObject({
      kind: "first_visit",
      region: "EXCEPTION_CATEGORY",
    });
  });

  it("ignores an exception category the rules do not list", () => {
    const patient = { ...outOfRegionPatient, telehealthException: "soldier" };
    expect(checkEligibility(input([], { patient }), draftRules)).toMatchObject({ kind: "not_allowed" });
  });

  it("does not check region for a follow-up visit", () => {
    const result = checkEligibility(input([visit("2026-10-01")], { patient: outOfRegionPatient }), draftRules);
    expect(result.kind).toBe("follow_up");
  });

  it("skips the region check when the rules do not require it", () => {
    expect(checkEligibility(input([], { patient: outOfRegionPatient }), legacyRules)).toMatchObject({
      kind: "first_visit",
      region: "NOT_REQUIRED",
    });
  });
});
