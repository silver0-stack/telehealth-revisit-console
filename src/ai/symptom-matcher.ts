import type { SymptomMatch } from "../domain/symptom.ts";

export type MatchInput = {
  /** The patient's own words in today's telehealth request. Synthetic text only. */
  todaySymptom: string;
  /** Note from an earlier in-person visit. */
  previousNote: string;
  /** KCD code recorded at that visit. */
  previousKcdCode: string;
};

// Both the rule-based baseline and the AI model implement this, so the review screen and the
// evaluation script (M4) never know which one they are talking to.
export interface SymptomMatcher {
  match(input: MatchInput): Promise<SymptomMatch>;
}
