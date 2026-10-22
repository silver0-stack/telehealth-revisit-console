import { describe, expect, it } from "vitest";
import { MATCH_LABELS } from "../domain/symptom.ts";
import { findCodes, RuleBasedMatcher } from "./rule-based-matcher.ts";

const matcher = new RuleBasedMatcher();
const match = (todaySymptom: string, previousKcdCode: string, previousNote = "") =>
  matcher.match({ todaySymptom, previousKcdCode, previousNote });

describe("findCodes", () => {
  it("ignores spacing differences", () => {
    expect(findCodes("목이 따가워요")).toEqual(new Set(["J02.9"]));
    expect(findCodes("목이따가워요")).toEqual(new Set(["J02.9"]));
  });

  it("can find more than one condition", () => {
    expect(findCodes("콧물이랑 기침, 재채기도 나요")).toEqual(new Set(["J06.9", "J30.4"]));
  });
});

describe("RuleBasedMatcher", () => {
  it("treats a synonym of the previous diagnosis as the same symptom (인후통 ~ 목 따가움)", async () => {
    const result = await match("목이 따가워요", "J02.9", "인후통, 발열 없음");
    expect(result.label).toBe("same");
    expect(result.probabilities.same).toBe(0.9);
  });

  it("is less sure when today's text also mentions other conditions", async () => {
    const result = await match("목이 따갑고 허리도 아파요", "J02.9");
    expect(result.label).toBe("same");
    expect(result.probabilities.same).toBeLessThan(0.8);
  });

  it("calls a condition in the same KCD chapter related", async () => {
    expect((await match("재채기가 계속 나요", "J02.9")).label).toBe("related");
  });

  it("calls an unrelated condition different", async () => {
    expect((await match("허리가 또 아파요", "J02.9")).label).toBe("different");
  });

  it("does not guess when it recognizes nothing", async () => {
    const result = await match("그냥 좀 이상해요", "J02.9");
    expect(Math.max(...MATCH_LABELS.map((l) => result.probabilities[l]))).toBeLessThan(0.5);
  });

  it("always returns probabilities that sum to 1 and names itself", async () => {
    for (const text of ["목이 따가워요", "허리가 아파요", "재채기", "모르겠어요"]) {
      const result = await match(text, "J02.9");
      const sum = MATCH_LABELS.reduce((s, l) => s + result.probabilities[l], 0);
      expect(sum).toBeCloseTo(1, 10);
      expect(result.matcher).toMatchObject({ kind: "rules", id: "rule-based" });
    }
  });
});
