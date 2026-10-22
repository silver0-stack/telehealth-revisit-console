import type { experimental_decide } from "ai";
import { describe, expect, it } from "vitest";
import { JevMatcher } from "./jev-matcher.ts";

type DecideFn = typeof experimental_decide;

// A stand-in for the real API: records what was sent and returns a canned answer.
function fakeDecide(answer: unknown, modelId = "typesafe-ai/jev-1.14.0") {
  const calls: unknown[] = [];
  const fn = (async (args: unknown) => {
    calls.push(args);
    return { answers: { match: answer }, response: { modelId } };
  }) as unknown as DecideFn;
  return { fn, calls };
}

const input = { todaySymptom: "목이 따가워요", previousNote: "인후통, 발열 없음", previousKcdCode: "J02.9" };

describe("JevMatcher", () => {
  it("maps a choice answer to a SymptomMatch and records the model that answered", async () => {
    const { fn } = fakeDecide({
      type: "choice",
      choice: "same",
      probabilities: { same: 0.93, related: 0.05, different: 0.02 },
    });
    const result = await new JevMatcher("typesafe-ai/jev-1.14.0", fn).match(input);
    expect(result).toEqual({
      label: "same",
      probabilities: { same: 0.93, related: 0.05, different: 0.02 },
      matcher: { kind: "ai", id: "typesafe-ai/jev", version: "typesafe-ai/jev-1.14.0" },
      explanation: null,
    });
  });

  it("sends only the symptom text, the earlier note and the diagnosis code", async () => {
    const { fn, calls } = fakeDecide({ choice: "same", probabilities: { same: 1, related: 0, different: 0 } });
    await new JevMatcher("typesafe-ai/jev-1.14.0", fn).match(input);
    expect(calls[0]).toMatchObject({
      model: "typesafe-ai/jev-1.14.0",
      state: { today_complaint: "목이 따가워요", earlier_visit: { diagnosis: "J02.9 급성 인두염", note: "인후통, 발열 없음" } },
    });
  });

  it("fails loudly when probabilities are missing instead of inventing them", async () => {
    const { fn } = fakeDecide({ type: "choice", choice: "same" });
    await expect(new JevMatcher("typesafe-ai/jev-1.14.0", fn).match(input)).rejects.toThrow(/probabilities/);
  });

  it("fails when probabilities do not add up", async () => {
    const { fn } = fakeDecide({ choice: "same", probabilities: { same: 0.9, related: 0.9, different: 0.9 } });
    await expect(new JevMatcher("typesafe-ai/jev-1.14.0", fn).match(input)).rejects.toThrow(/sum/);
  });
});
