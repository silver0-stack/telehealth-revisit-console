import type { EligibilityResult } from "./eligibility.ts";
import type { Rules } from "./rules.ts";
import type { Drug, PrescriptionRecord } from "./types.ts";

export type PrescriptionInput = {
  /** Outcome of checkEligibility for this request. */
  eligibility: EligibilityResult["kind"];
  drug: Drug;
  days: number;
  /** The clinician judges that existing treatment must continue (needed to go past the first-visit limit). */
  continuingTreatment: boolean;
  /** The clinician confirmed prior care and prescription history for this condition. */
  historyConfirmed: boolean;
  /** This patient's past prescriptions, used to see if the once-only extension was already used. */
  history: readonly PrescriptionRecord[];
};

export type PrescriptionReason =
  | "ALLOWED"
  | "ALLOWED_FIRST_VISIT_EXTENSION"
  | "TELEHEALTH_NOT_ALLOWED"
  | "BLOCKED_CATEGORY"
  | "BLOCKED_DRUG"
  | "FIRST_VISIT_OVER_MAX_DAYS"
  | "EXTENSION_NEEDS_HISTORY"
  | "EXTENSION_OVER_MAX_DAYS"
  | "EXTENSION_ALREADY_USED";

export type PrescriptionCheck = {
  result: "allowed" | "blocked";
  reason: PrescriptionReason;
  ruleVersion: string;
  /** Day limit that applied, or null when this version sets none. Shown so staff can fix the order. */
  maxDays: number | null;
};

// The order of checks matters: a drug that may never be prescribed by telehealth is reported as
// such even if the day count is also wrong, because changing the days would not help.
export function checkPrescription(input: PrescriptionInput, rules: Rules): PrescriptionCheck {
  if (!Number.isInteger(input.days) || input.days < 1) {
    throw new Error(`days must be a positive integer, got ${input.days}`);
  }
  const { prescription } = rules;
  const done = (reason: PrescriptionReason, maxDays: number | null = null): PrescriptionCheck => ({
    result: reason === "ALLOWED" || reason === "ALLOWED_FIRST_VISIT_EXTENSION" ? "allowed" : "blocked",
    reason,
    ruleVersion: rules.version,
    maxDays,
  });

  if (input.eligibility === "not_allowed") return done("TELEHEALTH_NOT_ALLOWED");

  // Applies to every telehealth visit, follow-up or first (draft 제31조의10).
  // ASSUMPTION (A11): the narrow 마약류 exceptions (희귀질환자 등) are not modeled; such orders are
  // blocked here and must be handled by the clinician outside this tool.
  if (prescription.blockedCategories.includes(input.drug.category)) return done("BLOCKED_CATEGORY");
  if (prescription.blockedDrugCodes.includes(input.drug.code)) return done("BLOCKED_DRUG");

  // Day limits apply only to first-visit telehealth (draft 제31조의3).
  const limit = prescription.firstVisitLimit;
  if (input.eligibility === "follow_up" || limit === null) return done("ALLOWED");
  if (input.days <= limit.maxDays) return done("ALLOWED", limit.maxDays);

  // Past the normal limit: only the once-only extension can allow it, and it needs both of
  // the clinician's confirmations from 제31조의3③.
  if (!input.continuingTreatment) return done("FIRST_VISIT_OVER_MAX_DAYS", limit.maxDays);
  if (!input.historyConfirmed) return done("EXTENSION_NEEDS_HISTORY", limit.maxDays);
  if (input.days > limit.extendedMaxDays) return done("EXTENSION_OVER_MAX_DAYS", limit.extendedMaxDays);
  const used = input.history.filter((r) => r.usedFirstVisitExtension).length;
  if (used >= limit.extendedTimesPerPatient) return done("EXTENSION_ALREADY_USED", limit.maxDays);
  return done("ALLOWED_FIRST_VISIT_EXTENSION", limit.extendedMaxDays);
}
