import { describe, expect, it } from "vitest";
import { checkPrescription, type PrescriptionInput } from "./prescription.ts";
import type { Rules } from "./rules.ts";
import type { Drug, PrescriptionRecord } from "./types.ts";

// Own rules object so tests do not change when config/rules is edited.
const rules: Rules = {
  version: "test-rx",
  source: "test",
  assumptions: [],
  followUp: { window: { amount: 6, unit: "month" } },
  firstVisit: { requireSameRegion: true, outsideRegionExceptions: [] },
  prescription: {
    blockedCategories: ["narcotic_psychotropic", "misuse_risk", "obesity_treatment"],
    blockedDrugCodes: ["DRG-099"],
    firstVisitLimit: { maxDays: 7, extendedMaxDays: 30, extendedTimesPerPatient: 1 },
  },
};

const amlodipine: Drug = { code: "DRG-003", name: "암로디핀", use: "고혈압", category: "general" };
const zolpidem: Drug = { code: "DRG-007", name: "졸피뎀", use: "불면", category: "narcotic_psychotropic" };
const semaglutide: Drug = { code: "DRG-010", name: "세마글루타이드", use: "체중 감량", category: "obesity_treatment" };
const clinicBlocked: Drug = { code: "DRG-099", name: "테스트약", use: "테스트", category: "general" };

const usedExtension: PrescriptionRecord = {
  id: "RX-0001",
  patientId: "P-0001",
  date: "2026-05-01",
  drugCode: "DRG-003",
  days: 30,
  setting: "telehealth_first_visit",
  usedFirstVisitExtension: true,
};

function input(overrides: Partial<PrescriptionInput> = {}): PrescriptionInput {
  return {
    eligibility: "first_visit",
    drug: amlodipine,
    days: 7,
    continuingTreatment: false,
    historyConfirmed: false,
    history: [],
    ...overrides,
  };
}

describe("checkPrescription: blocked drugs", () => {
  it("blocks a narcotic/psychotropic drug even on a follow-up visit", () => {
    expect(checkPrescription(input({ eligibility: "follow_up", drug: zolpidem }), rules)).toMatchObject({
      result: "blocked",
      reason: "BLOCKED_CATEGORY",
    });
  });

  it("blocks an obesity treatment", () => {
    expect(checkPrescription(input({ drug: semaglutide, days: 3 }), rules).reason).toBe("BLOCKED_CATEGORY");
  });

  it("blocks a single drug listed by code", () => {
    expect(checkPrescription(input({ drug: clinicBlocked }), rules).reason).toBe("BLOCKED_DRUG");
  });

  it("reports the blocked drug before a day-count problem", () => {
    expect(checkPrescription(input({ drug: zolpidem, days: 60 }), rules).reason).toBe("BLOCKED_CATEGORY");
  });

  it("blocks everything when telehealth itself is not allowed", () => {
    expect(checkPrescription(input({ eligibility: "not_allowed" }), rules)).toMatchObject({
      result: "blocked",
      reason: "TELEHEALTH_NOT_ALLOWED",
    });
  });
});

describe("checkPrescription: follow-up visits", () => {
  it("has no day limit for a general drug", () => {
    expect(checkPrescription(input({ eligibility: "follow_up", days: 90 }), rules)).toEqual({
      result: "allowed",
      reason: "ALLOWED",
      ruleVersion: "test-rx",
      maxDays: null,
    });
  });
});

describe("checkPrescription: first-visit day limit", () => {
  it("allows exactly the maximum (7 days)", () => {
    expect(checkPrescription(input({ days: 7 }), rules)).toMatchObject({ result: "allowed", maxDays: 7 });
  });

  it("blocks 8 days without the clinician's continuing-treatment judgment", () => {
    expect(checkPrescription(input({ days: 8 }), rules)).toMatchObject({
      result: "blocked",
      reason: "FIRST_VISIT_OVER_MAX_DAYS",
      maxDays: 7,
    });
  });

  it("needs confirmed history for the extension", () => {
    const result = checkPrescription(input({ days: 30, continuingTreatment: true }), rules);
    expect(result.reason).toBe("EXTENSION_NEEDS_HISTORY");
  });

  it("allows up to 30 days once with both confirmations", () => {
    const result = checkPrescription(input({ days: 30, continuingTreatment: true, historyConfirmed: true }), rules);
    expect(result).toMatchObject({ result: "allowed", reason: "ALLOWED_FIRST_VISIT_EXTENSION", maxDays: 30 });
  });

  it("blocks more than 30 days even with the extension", () => {
    const result = checkPrescription(input({ days: 31, continuingTreatment: true, historyConfirmed: true }), rules);
    expect(result).toMatchObject({ reason: "EXTENSION_OVER_MAX_DAYS", maxDays: 30 });
  });

  it("blocks the extension when the patient already used it", () => {
    const result = checkPrescription(
      input({ days: 14, continuingTreatment: true, historyConfirmed: true, history: [usedExtension] }),
      rules,
    );
    expect(result).toMatchObject({ result: "blocked", reason: "EXTENSION_ALREADY_USED" });
  });

  it("still allows a normal 7-day order after the extension was used", () => {
    expect(checkPrescription(input({ days: 7, history: [usedExtension] }), rules).result).toBe("allowed");
  });

  it("has no day limit when the rules version sets none", () => {
    const noLimit: Rules = { ...rules, prescription: { ...rules.prescription, firstVisitLimit: null } };
    expect(checkPrescription(input({ days: 60 }), noLimit)).toMatchObject({ result: "allowed", maxDays: null });
  });
});

describe("checkPrescription: input validation", () => {
  it.each([0, -1, 2.5, Number.NaN])("rejects a day count of %s", (days) => {
    expect(() => checkPrescription(input({ days }), rules)).toThrow();
  });
});
