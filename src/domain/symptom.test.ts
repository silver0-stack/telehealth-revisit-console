import { describe, expect, it } from "vitest";
import { chooseSuggestion, type MatchCandidate, type MatchLabel } from "./symptom.ts";

function candidate(visitId: string, label: MatchLabel, probabilities: [number, number, number]): MatchCandidate {
  const [same, related, different] = probabilities;
  return {
    visitId,
    kcdCode: "J02.9",
    match: {
      label,
      probabilities: { same, related, different },
      matcher: { kind: "rules", id: "test", version: "1" },
      explanation: null,
    },
  };
}

describe("chooseSuggestion", () => {
  it("pre-selects a 'same' match at or above the threshold", () => {
    const c = candidate("V-00001", "same", [0.8, 0.15, 0.05]);
    expect(chooseSuggestion([c], 0.8)).toEqual({ kind: "preselect", candidate: c });
  });

  it("does not pre-select a 'same' match just below the threshold", () => {
    const c = candidate("V-00001", "same", [0.79, 0.16, 0.05]);
    expect(chooseSuggestion([c], 0.8)).toEqual({ kind: "needs_review", best: c });
  });

  it("does not pre-select a confident 'different' answer", () => {
    const c = candidate("V-00001", "different", [0.05, 0.05, 0.9]);
    expect(chooseSuggestion([c], 0.8).kind).toBe("needs_review");
  });

  it("picks the visit with the highest chance of being the same symptom", () => {
    const back = candidate("V-00001", "different", [0.05, 0.1, 0.85]);
    const throat = candidate("V-00002", "same", [0.9, 0.07, 0.03]);
    expect(chooseSuggestion([back, throat], 0.8)).toEqual({ kind: "preselect", candidate: throat });
  });

  it("reports when there is nothing to compare with", () => {
    expect(chooseSuggestion([], 0.8)).toEqual({ kind: "no_candidates" });
  });
});
