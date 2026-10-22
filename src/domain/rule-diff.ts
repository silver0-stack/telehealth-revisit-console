import { checkEligibility, type EligibilityResult } from "./eligibility.ts";
import { checkPrescription, type PrescriptionReason } from "./prescription.ts";
import type { Rules } from "./rules.ts";
import type { Drug, Patient, PrescriptionRecord, Sido, Visit } from "./types.ts";

/** Everything the diff needs about one patient. */
export type PatientRecord = {
  patient: Patient;
  visits: readonly Visit[];
  prescriptions: readonly PrescriptionRecord[];
};

export type DiffContext = {
  clinicRegion: Sido;
  /** The moment the "what if they asked today?" scenarios are evaluated at. */
  requestedAt: string;
  drugs: readonly Drug[];
};

type Kind = EligibilityResult["kind"];

export type EligibilityChange = {
  patientId: string;
  /** The condition the scenario asks about, or null for "a new symptom". */
  kcdCode: string | null;
  before: Kind;
  after: Kind;
  direction: "worse" | "better";
};

export type OrderChange = {
  patientId: string;
  drugCode: string;
  days: number;
  before: PrescriptionReason;
  after: PrescriptionReason;
  direction: "newly_blocked" | "newly_allowed";
};

export type RuleDiff = {
  from: string;
  to: string;
  scenarios: number;
  orders: number;
  eligibilityChanges: EligibilityChange[];
  orderChanges: OrderChange[];
  counts: {
    lostFollowUp: number;
    gainedFollowUp: number;
    lostTelehealth: number;
    gainedTelehealth: number;
    newlyBlocked: number;
    newlyAllowed: number;
  };
};

const RANK: Record<Kind, number> = { not_allowed: 0, first_visit: 1, follow_up: 2 };

// Sentinel for "a symptom this clinic has never seen in person". No real KCD code looks like this.
const NEW_SYMPTOM = "NEW";

/**
 * What changes for patients if `newRules` replaces `oldRules`? Pure: same inputs, same answer, no I/O.
 *
 * Scenarios (assumptions, shown on the screen):
 * - Eligibility: for each patient, one request per condition they were seen for in person, plus one
 *   request for a new symptom. Each is checked "as if requested at context.requestedAt".
 * - Orders: each patient's latest prescription per drug that came from a visit is repeated by telehealth
 *   with the same day count, with the clinician confirming history and continuing treatment.
 */
export function diffRules(
  oldRules: Rules,
  newRules: Rules,
  patients: readonly PatientRecord[],
  context: DiffContext,
): RuleDiff {
  const eligibilityChanges: EligibilityChange[] = [];
  const orderChanges: OrderChange[] = [];
  let scenarios = 0;
  let orders = 0;

  for (const record of patients) {
    const codes = [...new Set(record.visits.filter((v) => v.mode === "in_person").map((v) => v.kcdCode))];
    const kindFor = (rules: Rules, kcdCode: string) =>
      checkEligibility(
        {
          patient: record.patient,
          clinicRegion: context.clinicRegion,
          requestedAt: context.requestedAt,
          symptomKcdCode: kcdCode,
          visits: record.visits,
        },
        rules,
      ).kind;

    for (const kcdCode of [...codes, NEW_SYMPTOM]) {
      scenarios += 1;
      const before = kindFor(oldRules, kcdCode);
      const after = kindFor(newRules, kcdCode);
      if (before !== after) {
        eligibilityChanges.push({
          patientId: record.patient.id,
          kcdCode: kcdCode === NEW_SYMPTOM ? null : kcdCode,
          before,
          after,
          direction: RANK[after] < RANK[before] ? "worse" : "better",
        });
      }
    }

    for (const rx of latestPerDrug(record.prescriptions)) {
      const visit = record.visits.find((v) => v.date === rx.date);
      const drug = context.drugs.find((d) => d.code === rx.drugCode);
      // Extension records (another clinic) have no visit here, so there is no condition to ask about.
      if (!visit || !drug) continue;
      orders += 1;
      const reasonFor = (rules: Rules) =>
        checkPrescription(
          {
            eligibility: kindFor(rules, visit.kcdCode),
            drug,
            days: rx.days,
            continuingTreatment: true,
            historyConfirmed: true,
            history: record.prescriptions,
          },
          rules,
        );
      const before = reasonFor(oldRules);
      const after = reasonFor(newRules);
      if (before.result !== after.result) {
        orderChanges.push({
          patientId: record.patient.id,
          drugCode: rx.drugCode,
          days: rx.days,
          before: before.reason,
          after: after.reason,
          direction: after.result === "blocked" ? "newly_blocked" : "newly_allowed",
        });
      }
    }
  }

  const isFollowUp = (k: Kind) => k === "follow_up";
  const isAllowed = (k: Kind) => k !== "not_allowed";
  return {
    from: oldRules.version,
    to: newRules.version,
    scenarios,
    orders,
    eligibilityChanges,
    orderChanges,
    counts: {
      lostFollowUp: eligibilityChanges.filter((c) => isFollowUp(c.before) && !isFollowUp(c.after)).length,
      gainedFollowUp: eligibilityChanges.filter((c) => !isFollowUp(c.before) && isFollowUp(c.after)).length,
      lostTelehealth: eligibilityChanges.filter((c) => isAllowed(c.before) && !isAllowed(c.after)).length,
      gainedTelehealth: eligibilityChanges.filter((c) => !isAllowed(c.before) && isAllowed(c.after)).length,
      newlyBlocked: orderChanges.filter((c) => c.direction === "newly_blocked").length,
      newlyAllowed: orderChanges.filter((c) => c.direction === "newly_allowed").length,
    },
  };
}

function latestPerDrug(prescriptions: readonly PrescriptionRecord[]): PrescriptionRecord[] {
  const latest = new Map<string, PrescriptionRecord>();
  for (const rx of prescriptions) {
    const seen = latest.get(rx.drugCode);
    if (!seen || rx.date > seen.date) latest.set(rx.drugCode, rx);
  }
  return [...latest.values()];
}
