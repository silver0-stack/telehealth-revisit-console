import { differenceInCalendarDays, parseISO } from "date-fns";
import { toSeoulDate } from "./dates.ts";
import type { Rules } from "./rules.ts";
import type { Visit } from "./types.ts";

export type EligibilityReason =
  | "IN_PERSON_VISIT_WITHIN_WINDOW"
  | "NO_VISIT"
  | "ONLY_TELEHEALTH_VISITS"
  | "NO_MATCHING_SYMPTOM"
  | "OUTSIDE_WINDOW";

export type EligibilityInput = {
  patientId: string;
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

export type EligibilityResult = {
  eligible: boolean;
  reason: EligibilityReason;
  ruleVersion: string;
  /** The in-person visit that made the request eligible, or null. */
  evidenceVisitId: string | null;
};

export function checkEligibility(input: EligibilityInput, rules: Rules): EligibilityResult {
  const requestDate = parseISO(toSeoulDate(input.requestedAt));
  const result = (reason: EligibilityReason, evidenceVisitId: string | null = null): EligibilityResult => ({
    eligible: reason === "IN_PERSON_VISIT_WITHIN_WINDOW",
    reason,
    ruleVersion: rules.version,
    evidenceVisitId,
  });

  // Visits dated after the request cannot justify it (e.g. data entered for a later appointment).
  const pastVisits = input.visits.filter(
    (v) => v.patientId === input.patientId && differenceInCalendarDays(requestDate, parseISO(v.date)) >= 0,
  );
  if (pastVisits.length === 0) return result("NO_VISIT");

  // ASSUMPTION (A2): only an in-person visit counts; a telehealth visit never does.
  const inPerson = pastVisits.filter((v) => v.mode === "in_person");
  if (inPerson.length === 0) return result("ONLY_TELEHEALTH_VISITS");

  const sameSymptom = inPerson.filter((v) => v.kcdCode === input.symptomKcdCode);
  if (sameSymptom.length === 0) return result("NO_MATCHING_SYMPTOM");

  // ASSUMPTION (A1, A3): the window comes from config and includes the boundary day,
  // so a visit exactly `revisitWindowDays` days ago still counts.
  const windowDays = rules.eligibility.revisitWindowDays;
  const withinWindow = sameSymptom
    .filter((v) => differenceInCalendarDays(requestDate, parseISO(v.date)) <= windowDays)
    // Most recent first, so the evidence shown to the clinician is the latest relevant visit.
    .sort((a, b) => b.date.localeCompare(a.date));

  const evidence = withinWindow[0];
  return evidence ? result("IN_PERSON_VISIT_WITHIN_WINDOW", evidence.id) : result("OUTSIDE_WINDOW");
}
