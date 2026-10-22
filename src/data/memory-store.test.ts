import { describe, expect, it } from "vitest";
import rulesV2 from "../../config/rules/rules.v2.json" with { type: "json" };
import { RulesSchema } from "../domain/rules.ts";
import { MemoryStore } from "./memory-store.ts";
import type { SuggestionRecord } from "./store.ts";

const suggestion = (minConfidence: number): SuggestionRecord => ({
  suggestion: { kind: "no_candidates" },
  candidates: [],
  minConfidence,
});

describe("MemoryStore", () => {
  it("keeps the first suggestion saved for a request", async () => {
    const store = new MemoryStore();
    await store.saveSuggestion("R-0001", suggestion(0.8));
    expect((await store.saveSuggestion("R-0001", suggestion(0.5))).minConfidence).toBe(0.8);
  });

  it("refuses a second rule version with the same name", async () => {
    const store = new MemoryStore();
    const entry = {
      rules: RulesSchema.parse({ ...rulesV2, version: "v3" }),
      origin: "admin" as const,
      savedAt: null,
      savedBy: "테스트 관리자",
    };
    await store.saveRuleVersion(entry);
    await expect(store.saveRuleVersion(entry)).rejects.toThrow(/already exists/);
  });

  it("reset clears decisions but keeps suggestions, so it does not spend AI calls again", async () => {
    const store = new MemoryStore();
    await store.saveReview("R-0001", { state: { status: "held", reason: "확인" }, eligibility: null });
    await store.saveSuggestion("R-0001", suggestion(0.8));
    await store.resetDemo();
    expect(await store.getReview("R-0001")).toBeNull();
    expect(await store.getSuggestion("R-0001")).not.toBeNull();
  });
});
