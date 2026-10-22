// Types shared by every symptom matcher (rule-based or AI). They live in the domain so the
// review logic can use them without depending on any matcher implementation.

export const MATCH_LABELS = ["same", "related", "different"] as const;
export type MatchLabel = (typeof MATCH_LABELS)[number];

export type MatcherInfo = {
  /** "rules" for the deterministic baseline, "ai" for a model. Decides how the UI labels the suggestion. */
  kind: "rules" | "ai";
  /** e.g. "rule-based" or "typesafe-ai/jev". Recorded in the audit log. */
  id: string;
  version: string;
};

/** Answer to: is today's symptom the same as, related to, or different from this earlier in-person visit? */
export type SymptomMatch = {
  label: MatchLabel;
  /** One value per label, summing to 1. */
  probabilities: Record<MatchLabel, number>;
  matcher: MatcherInfo;
  /** Short human-readable reason, if the matcher can give one (the rule-based matcher can). */
  explanation: string | null;
};

/** One earlier in-person visit the request was compared with. */
export type MatchCandidate = {
  visitId: string;
  kcdCode: string;
  match: SymptomMatch;
};

export type Suggestion =
  /** A clear "same" match: pre-select this visit's code; the clinician still approves or edits. */
  | { kind: "preselect"; candidate: MatchCandidate }
  /** Nothing clear enough: show "의사 확인 필요" and pre-select nothing. */
  | { kind: "needs_review"; best: MatchCandidate | null }
  /** No in-person visit to compare with. */
  | { kind: "no_candidates" };

export function topProbability(match: SymptomMatch): number {
  return Math.max(...MATCH_LABELS.map((l) => match.probabilities[l]));
}

/**
 * Picks the candidate most likely to be the same symptom, and pre-selects it only when the matcher
 * says "same" with at least `minConfidence`. A lower score must never look like a decision.
 */
export function chooseSuggestion(candidates: readonly MatchCandidate[], minConfidence: number): Suggestion {
  if (candidates.length === 0) return { kind: "no_candidates" };
  const best = [...candidates].sort((a, b) => b.match.probabilities.same - a.match.probabilities.same)[0];
  if (!best) return { kind: "no_candidates" };
  if (best.match.label === "same" && topProbability(best.match) >= minConfidence) {
    return { kind: "preselect", candidate: best };
  }
  return { kind: "needs_review", best };
}
