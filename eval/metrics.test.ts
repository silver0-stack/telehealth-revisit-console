import { describe, expect, it } from "vitest";
import type { MatchLabel } from "../src/domain/symptom.ts";
import { summarize, type Prediction } from "./metrics.ts";

function pred(id: string, truth: MatchLabel, predicted: MatchLabel, topP: number, tags: string[] = []): Prediction {
  const rest = (1 - topP) / 2;
  const probabilities = { same: rest, related: rest, different: rest };
  probabilities[predicted] = topP;
  return { id, tags, truth, predicted, probabilities };
}

describe("summarize", () => {
  const predictions = [
    pred("C-1", "same", "same", 0.95, ["synonym"]),
    pred("C-2", "same", "same", 0.7, ["typo"]),
    pred("C-3", "different", "same", 0.9, ["lookalike"]),
    pred("C-4", "related", "related", 0.6, ["related"]),
    pred("C-5", "different", "related", 0.55, ["lookalike"]),
  ];
  const s = summarize(predictions, 0.8);

  it("computes overall and per-tag accuracy", () => {
    expect(s.total).toBe(5);
    expect(s.accuracy).toBeCloseTo(3 / 5);
    expect(s.byTag.lookalike).toEqual({ n: 2, accuracy: 0 });
    expect(s.byTag.synonym).toEqual({ n: 1, accuracy: 1 });
  });

  it("counts only confident 'same' answers as pre-selections and flags the wrong ones", () => {
    expect(s.preselection).toEqual({
      minConfidence: 0.8,
      preselected: 2,
      precision: 0.5,
      wrongPreselections: ["C-3"],
      missedSame: 1,
    });
  });

  it("groups answers by confidence and compares confidence with accuracy", () => {
    const high = s.calibration.find((b) => b.range === "0.9–1.0");
    expect(high).toMatchObject({ n: 2, accuracy: 0.5 });
    expect(high?.meanConfidence).toBeCloseTo(0.925);
  });

  it("lists the most common confusions first", () => {
    expect(s.confusion.different.same).toBe(1);
    expect(s.topConfusions.map((c) => `${c.truth}->${c.predicted}`)).toEqual(["different->same", "different->related"]);
  });
});
