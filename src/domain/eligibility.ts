import { periodEnd, toSeoulDate } from "./dates.ts";
import type { Rules } from "./rules.ts";
import type { Patient, Sido, Visit } from "./types.ts";

/** Why the request is not a follow-up (일반) telehealth visit. */
export type NotFollowUpReason =
  | "NO_VISIT"
  | "ONLY_TELEHEALTH_VISITS"
  | "NO_MATCHING_SYMPTOM"
  | "OUTSIDE_WINDOW";

/** How a first-visit (초진) telehealth request passed or failed the region check. */
export type RegionCheck = "NOT_REQUIRED" | "SAME_REGION" | "EXCEPTION_CATEGORY" | "OUTSIDE_REGION";

export type EligibilityInput = {
  patient: Pick<Patient, "id" | "region" | "telehealthException">;
  clinicRegion: Sido;
  /** When the telehealth request was made, ISO date-time with offset. */
  requestedAt: string;
  /**
   * KCD code of today's symptom, already confirmed (by a clinician, possibly helped by the
   * symptom matcher in M3). Eligibility itself never guesses what the symptom is.
   */
  symptomKcdCode: string;
  /** Visits at this clinic. The app models a single clinic, so "same clinic" is implied. */
  visits: readonly Visit[];
};

// Three outcomes instead of yes/no: under the draft rules, failing the follow-up check
// does not mean "refuse" but "treat as first-visit telehealth", which has its own conditions.
export type EligibilityResult =
  | { kind: "follow_up"; ruleVersion: string; evidenceVisitId: string; windowEnd: string }
  | { kind: "first_visit"; ruleVersion: string; notFollowUp: NotFollowUpReason; region: RegionCheck }
  | { kind: "not_allowed"; ruleVersion: string; notFollowUp: NotFollowUpReason; region: "OUTSIDE_REGION" };

export function checkEligibility(input: EligibilityInput, rules: Rules): EligibilityResult {
  const ruleVersion = rules.version;
  const followUp = findFollowUpEvidence(input, rules);
  if (followUp.ok) {
    return { kind: "follow_up", ruleVersion, evidenceVisitId: followUp.visit.id, windowEnd: followUp.windowEnd };
  }

  const region = checkRegion(input, rules);
  if (region === "OUTSIDE_REGION") {
    return { kind: "not_allowed", ruleVersion, notFollowUp: followUp.reason, region };
  }
  return { kind: "first_visit", ruleVersion, notFollowUp: followUp.reason, region };
}

type FollowUpCheck = { ok: true; visit: Visit; windowEnd: string } | { ok: false; reason: NotFollowUpReason };

function findFollowUpEvidence(input: EligibilityInput, rules: Rules): FollowUpCheck {
  // ISO dates (yyyy-MM-dd) compare correctly as plain strings.
  const requestDate = toSeoulDate(input.requestedAt);

  // Visits dated after the request cannot justify it (e.g. data entered for a later appointment).
  const pastVisits = input.visits.filter((v) => v.patientId === input.patient.id && v.date <= requestDate);
  if (pastVisits.length === 0) return { ok: false, reason: "NO_VISIT" };

  // ASSUMPTION (A2): only an in-person (대면) visit counts; a telehealth visit never does.
  const inPerson = pastVisits.filter((v) => v.mode === "in_person");
  if (inPerson.length === 0) return { ok: false, reason: "ONLY_TELEHEALTH_VISITS" };

  const sameSymptom = inPerson.filter((v) => v.kcdCode === input.symptomKcdCode);
  if (sameSymptom.length === 0) return { ok: false, reason: "NO_MATCHING_SYMPTOM" };

  // ASSUMPTION (A1, A3, A6): the most recent same-symptom in-person visit opens a window of
  // rules.followUp.window; the request must fall on or before the window's last day.
  const latest = [...sameSymptom].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return { ok: false, reason: "NO_MATCHING_SYMPTOM" };
  const windowEnd = periodEnd(latest.date, rules.followUp.window);
  return requestDate <= windowEnd ? { ok: true, visit: latest, windowEnd } : { ok: false, reason: "OUTSIDE_WINDOW" };
}

function checkRegion(input: EligibilityInput, rules: Rules): RegionCheck {
  if (!rules.firstVisit.requireSameRegion) return "NOT_REQUIRED";
  if (input.patient.region === input.clinicRegion) return "SAME_REGION";
  const exception = input.patient.telehealthException;
  if (exception !== null && rules.firstVisit.outsideRegionExceptions.includes(exception)) {
    return "EXCEPTION_CATEGORY";
  }
  return "OUTSIDE_REGION";
}
