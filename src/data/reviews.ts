import { getSymptomMatcher } from "../ai/index.ts";
import type { EligibilityResult } from "../domain/eligibility.ts";
import type { ReviewState } from "../domain/review.ts";
import { chooseSuggestion, type MatchCandidate, type Suggestion } from "../domain/symptom.ts";
import type { TelehealthRequest, Visit } from "../domain/types.ts";
import { getAiConfig } from "./ai-config.ts";
import { getRecordSource } from "./index.ts";

export type ReviewRecord = {
  state: ReviewState;
  /** Set when approved: eligibility computed from the clinician-confirmed code. */
  eligibility: EligibilityResult | null;
};

export type SuggestionRecord = {
  suggestion: Suggestion;
  candidates: MatchCandidate[];
  minConfidence: number;
};

// In memory for the demo (resets on restart).
const reviews = new Map<string, ReviewRecord>();
// The suggestion is computed once per request and kept, so the clinician decides on exactly what
// the audit log records, and an AI matcher is not called again on every page view.
const suggestions = new Map<string, Promise<SuggestionRecord>>();

export function getReview(requestId: string): ReviewRecord {
  return reviews.get(requestId) ?? { state: { status: "pending" }, eligibility: null };
}

export function saveReview(requestId: string, record: ReviewRecord): void {
  reviews.set(requestId, record);
}

/** In-person visits worth comparing with: the latest one per KCD code, newest first, at most five. */
export function comparisonVisits(visits: readonly Visit[], requestDate: string): Visit[] {
  const latestByCode = new Map<string, Visit>();
  for (const v of visits) {
    if (v.mode !== "in_person" || v.date > requestDate) continue;
    const seen = latestByCode.get(v.kcdCode);
    if (!seen || v.date > seen.date) latestByCode.set(v.kcdCode, v);
  }
  return [...latestByCode.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

export function getSuggestion(request: TelehealthRequest, requestDate: string): Promise<SuggestionRecord> {
  let pending = suggestions.get(request.id);
  if (!pending) {
    pending = computeSuggestion(request, requestDate);
    // A failed matcher call must not stay cached as a failure; the next view retries.
    pending.catch(() => suggestions.delete(request.id));
    suggestions.set(request.id, pending);
  }
  return pending;
}

async function computeSuggestion(request: TelehealthRequest, requestDate: string): Promise<SuggestionRecord> {
  const matcher = getSymptomMatcher();
  const { minConfidence } = getAiConfig();
  const visits = await getRecordSource().listVisits(request.patientId);
  const candidates: MatchCandidate[] = [];
  for (const visit of comparisonVisits(visits, requestDate)) {
    const match = await matcher.match({
      todaySymptom: request.symptomText,
      previousNote: visit.note,
      previousKcdCode: visit.kcdCode,
    });
    candidates.push({ visitId: visit.id, kcdCode: visit.kcdCode, match });
  }
  return { suggestion: chooseSuggestion(candidates, minConfidence), candidates, minConfidence };
}
