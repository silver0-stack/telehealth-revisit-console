import { MATCH_LABELS, type MatchLabel } from "../src/domain/symptom.ts";

export type Prediction = {
  id: string;
  tags: readonly string[];
  truth: MatchLabel;
  predicted: MatchLabel;
  probabilities: Record<MatchLabel, number>;
};

export type CalibrationBin = { range: string; n: number; meanConfidence: number; accuracy: number };

export type Summary = {
  total: number;
  accuracy: number;
  byTag: Record<string, { n: number; accuracy: number }>;
  // The app only acts on "same" (pre-selection), so these are the numbers that matter most.
  preselection: {
    minConfidence: number;
    /** Cases the app would pre-select: predicted "same" with top probability >= minConfidence. */
    preselected: number;
    /** Of those, how many really were the same symptom. */
    precision: number;
    /** Pre-selected but not the same symptom: the dangerous error (wrong follow-up). */
    wrongPreselections: string[];
    /** Truly "same" cases the app left for the clinician to pick by hand. */
    missedSame: number;
  };
  calibration: CalibrationBin[];
  confusion: Record<MatchLabel, Record<MatchLabel, number>>;
  topConfusions: { truth: MatchLabel; predicted: MatchLabel; n: number; ids: string[] }[];
};

const BIN_EDGES = [0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];

function top(p: Record<MatchLabel, number>): number {
  return Math.max(...MATCH_LABELS.map((l) => p[l]));
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

export function summarize(predictions: readonly Prediction[], minConfidence: number): Summary {
  const correct = (p: Prediction) => p.predicted === p.truth;

  const byTag: Summary["byTag"] = {};
  for (const tag of new Set(predictions.flatMap((p) => p.tags))) {
    const group = predictions.filter((p) => p.tags.includes(tag));
    byTag[tag] = { n: group.length, accuracy: ratio(group.filter(correct).length, group.length) };
  }

  const preselected = predictions.filter((p) => p.predicted === "same" && top(p.probabilities) >= minConfidence);
  const wrong = preselected.filter((p) => p.truth !== "same");
  const missedSame = predictions.filter((p) => p.truth === "same" && !preselected.includes(p)).length;

  // Calibration: when the matcher says "80% sure", is it right about 80% of the time?
  const calibration: CalibrationBin[] = [];
  for (let i = 0; i < BIN_EDGES.length - 1; i++) {
    const lo = BIN_EDGES[i]!;
    const hi = BIN_EDGES[i + 1]!;
    const bin = predictions.filter((p) => top(p.probabilities) >= lo && top(p.probabilities) < hi);
    if (bin.length === 0) continue;
    calibration.push({
      range: `${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)}`,
      n: bin.length,
      meanConfidence: bin.reduce((s, p) => s + top(p.probabilities), 0) / bin.length,
      accuracy: ratio(bin.filter(correct).length, bin.length),
    });
  }

  const confusion = Object.fromEntries(
    MATCH_LABELS.map((t) => [t, Object.fromEntries(MATCH_LABELS.map((p) => [p, 0]))]),
  ) as Summary["confusion"];
  for (const p of predictions) confusion[p.truth][p.predicted] += 1;

  const topConfusions = MATCH_LABELS.flatMap((truth) =>
    MATCH_LABELS.filter((predicted) => predicted !== truth).map((predicted) => {
      const ids = predictions.filter((p) => p.truth === truth && p.predicted === predicted).map((p) => p.id);
      return { truth, predicted, n: ids.length, ids };
    }),
  )
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  return {
    total: predictions.length,
    accuracy: ratio(predictions.filter(correct).length, predictions.length),
    byTag,
    preselection: {
      minConfidence,
      preselected: preselected.length,
      precision: ratio(preselected.length - wrong.length, preselected.length),
      wrongPreselections: wrong.map((p) => p.id),
      missedSame,
    },
    calibration,
    confusion,
    topConfusions,
  };
}
