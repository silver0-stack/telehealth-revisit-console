import { describe, expect, it } from "vitest";
import { diffRules, type DiffContext, type PatientRecord } from "./rule-diff.ts";
import type { Rules } from "./rules.ts";
import type { Drug, Patient, PrescriptionRecord, Visit } from "./types.ts";

// Own rules objects, shaped like the shipped v1 (30 days, no region check) and v2 (6 months, region check).
const v1: Rules = {
  version: "t1",
  source: "test",
  assumptions: [],
  followUp: { window: { amount: 30, unit: "day" } },
  firstVisit: { requireSameRegion: false, outsideRegionExceptions: [] },
  prescription: { blockedCategories: ["narcotic_psychotropic"], blockedDrugCodes: [], firstVisitLimit: null },
};
const v2: Rules = {
  ...v1,
  version: "t2",
  followUp: { window: { amount: 6, unit: "month" } },
  firstVisit: { requireSameRegion: true, outsideRegionExceptions: ["rare_disease"] },
  prescription: {
    blockedCategories: ["narcotic_psychotropic", "obesity_treatment"],
    blockedDrugCodes: [],
    firstVisitLimit: { maxDays: 7, extendedMaxDays: 30, extendedTimesPerPatient: 1 },
  },
};

const drugs: Drug[] = [
  { code: "DRG-001", name: "아목시실린", use: "감염", category: "general" },
  { code: "DRG-003", name: "암로디핀", use: "고혈압", category: "general" },
  { code: "DRG-010", name: "세마글루타이드", use: "체중", category: "obesity_treatment" },
];
const context: DiffContext = { clinicRegion: "서울특별시", requestedAt: "2026-10-20T09:00:00+09:00", drugs };

function patient(id: string, region: Patient["region"] = "서울특별시"): Patient {
  return { id, displayName: "테스트", birthYear: 1980, region, telehealthException: null };
}
function visit(id: string, patientId: string, date: string, kcdCode: string, mode: Visit["mode"] = "in_person"): Visit {
  return { id, patientId, date, mode, kcdCode, note: "" };
}
function rx(id: string, patientId: string, date: string, drugCode: string, days: number): PrescriptionRecord {
  return { id, patientId, date, drugCode, days, setting: "in_person", usedFirstVisitExtension: false };
}

describe("diffRules: eligibility", () => {
  it("finds a patient who gains follow-up when the window grows from 30 days to 6 months", () => {
    const records: PatientRecord[] = [
      { patient: patient("P-0001"), visits: [visit("V-00001", "P-0001", "2026-08-01", "I10")], prescriptions: [] },
    ];
    const diff = diffRules(v1, v2, records, context);
    expect(diff.eligibilityChanges).toEqual([
      { patientId: "P-0001", kcdCode: "I10", before: "first_visit", after: "follow_up", direction: "better" },
    ]);
    expect(diff.counts).toMatchObject({ gainedFollowUp: 1, lostFollowUp: 0 });
  });

  it("finds a new out-of-region patient who loses telehealth when the region check starts", () => {
    const records: PatientRecord[] = [{ patient: patient("P-0002", "부산광역시"), visits: [], prescriptions: [] }];
    const diff = diffRules(v1, v2, records, context);
    expect(diff.eligibilityChanges).toEqual([
      { patientId: "P-0002", kcdCode: null, before: "first_visit", after: "not_allowed", direction: "worse" },
    ]);
    expect(diff.counts.lostTelehealth).toBe(1);
  });

  it("reports nothing for a patient whose result does not change", () => {
    const records: PatientRecord[] = [
      { patient: patient("P-0003"), visits: [visit("V-00002", "P-0003", "2026-10-10", "J02.9")], prescriptions: [] },
    ];
    const diff = diffRules(v1, v2, records, context);
    expect(diff.eligibilityChanges).toEqual([]);
    expect(diff.scenarios).toBe(2); // J02.9 and "new symptom"
  });

  it("never turns telehealth-only history into follow-up, under either version", () => {
    const records: PatientRecord[] = [
      {
        patient: patient("P-0004"),
        visits: [visit("V-00003", "P-0004", "2026-10-01", "J02.9", "telehealth")],
        prescriptions: [],
      },
    ];
    expect(diffRules(v1, v2, records, context).counts.gainedFollowUp).toBe(0);
  });

  it("shows the reverse change when comparing the other way", () => {
    const records: PatientRecord[] = [
      { patient: patient("P-0001"), visits: [visit("V-00001", "P-0001", "2026-08-01", "I10")], prescriptions: [] },
    ];
    expect(diffRules(v2, v1, records, context).counts).toMatchObject({ lostFollowUp: 1, gainedFollowUp: 0 });
  });
});

describe("diffRules: orders", () => {
  it("finds a repeat order that becomes blocked by a newly blocked category", () => {
    const records: PatientRecord[] = [
      {
        patient: patient("P-0005"),
        visits: [visit("V-00004", "P-0005", "2026-10-01", "E11.9")],
        prescriptions: [rx("RX-0001", "P-0005", "2026-10-01", "DRG-010", 14)],
      },
    ];
    const diff = diffRules(v1, v2, records, context);
    expect(diff.orderChanges).toEqual([
      {
        patientId: "P-0005",
        drugCode: "DRG-010",
        days: 14,
        before: "ALLOWED",
        after: "BLOCKED_CATEGORY",
        direction: "newly_blocked",
      },
    ]);
  });

  it("finds a long first-visit repeat that the new day limit blocks only past 30 days", () => {
    const records: PatientRecord[] = [
      {
        // Seen for hypertension 8 months ago: first visit under both versions.
        patient: patient("P-0006"),
        visits: [visit("V-00005", "P-0006", "2026-02-01", "I10")],
        prescriptions: [rx("RX-0002", "P-0006", "2026-02-01", "DRG-003", 60)],
      },
    ];
    const diff = diffRules(v1, v2, records, context);
    expect(diff.orderChanges).toMatchObject([{ drugCode: "DRG-003", after: "EXTENSION_OVER_MAX_DAYS" }]);
    expect(diff.counts.newlyBlocked).toBe(1);
  });

  it("uses only the latest prescription per drug", () => {
    const records: PatientRecord[] = [
      {
        patient: patient("P-0007"),
        visits: [visit("V-00006", "P-0007", "2026-09-01", "J02.9"), visit("V-00007", "P-0007", "2026-10-01", "J02.9")],
        prescriptions: [rx("RX-0003", "P-0007", "2026-09-01", "DRG-001", 5), rx("RX-0004", "P-0007", "2026-10-01", "DRG-001", 7)],
      },
    ];
    expect(diffRules(v1, v2, records, context).orders).toBe(1);
  });
});
