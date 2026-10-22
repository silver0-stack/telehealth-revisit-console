import { getSymptomMatcher } from "../ai/index.ts";
import { chooseSuggestion, type MatchCandidate } from "../domain/symptom.ts";
import type { TelehealthRequest, Visit } from "../domain/types.ts";
import { getAiConfig } from "./ai-config.ts";
import { getRecordSource } from "./index.ts";
import { getStore, type ReviewRecord, type SuggestionRecord } from "./store.ts";

export type { ReviewRecord, SuggestionRecord } from "./store.ts";

const PENDING: ReviewRecord = { state: { status: "pending" }, eligibility: null };

// Requests whose suggestion is being computed by this server instance right now, so two page views
// at the same moment share one set of matcher calls instead of making two.
const inFlight = new Map<string, Promise<SuggestionRecord>>();

export async function getReview(requestId: string): Promise<ReviewRecord> {
  return (await getStore().getReview(requestId)) ?? PENDING;
}

export async function listReviews(): Promise<Map<string, ReviewRecord>> {
  return getStore().listReviews();
}

export async function saveReview(requestId: string, record: ReviewRecord): Promise<void> {
  await getStore().saveReview(requestId, record);
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

// The suggestion is computed once per request and stored, so the clinician decides on exactly what
// the audit log records, every server instance shows the same numbers, and an AI matcher is not
// called again on every page view (D15).
export async function getSuggestion(request: TelehealthRequest, requestDate: string): Promise<SuggestionRecord> {
  const stored = await getStore().getSuggestion(request.id);
  if (stored) return stored;

  let pending = inFlight.get(request.id);
  if (!pending) {
    pending = computeSuggestion(request, requestDate).then((record) => getStore().saveSuggestion(request.id, record));
    // Failed or not, the next view asks the store again: a failure is never kept as the answer.
    const forget = () => inFlight.delete(request.id);
    pending.then(forget, forget);
    inFlight.set(request.id, pending);
  }
  return pending;
}

async function computeSuggestion(request: TelehealthRequest, requestDate: string): Promise<SuggestionRecord> {
  const matcher = getSymptomMatcher();
  const { minConfidence } = getAiConfig();
  const visits = await getRecordSource().listVisits(request.patientId);
  // The comparisons are independent, so they run in parallel: with an AI matcher the first page view
  // waits for the slowest call instead of the sum of all calls. Promise.all keeps the input order.
  const candidates: MatchCandidate[] = await Promise.all(
    comparisonVisits(visits, requestDate).map(async (visit) => ({
      visitId: visit.id,
      kcdCode: visit.kcdCode,
      match: await matcher.match({
        todaySymptom: request.symptomText,
        previousNote: visit.note,
        previousKcdCode: visit.kcdCode,
      }),
    })),
  );
  return { suggestion: chooseSuggestion(candidates, minConfidence), candidates, minConfidence };
}
