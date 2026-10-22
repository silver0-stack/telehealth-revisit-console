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

const v3 = {
  rules: RulesSchema.parse({ ...rulesV2, version: "v3" }),
  origin: "admin" as const,
  savedAt: null,
  savedBy: "테스트 관리자",
};

describe("MemoryStore", () => {
  it("keeps the first suggestion saved for a request, shared by every sandbox", async () => {
    const store = new MemoryStore();
    await store.saveSuggestion("R-0001", suggestion(0.8));
    expect((await store.saveSuggestion("R-0001", suggestion(0.5))).minConfidence).toBe(0.8);
  });

  it("refuses a second rule version with the same name in one sandbox", async () => {
    const store = new MemoryStore();
    await store.saveRuleVersion("s1", v3);
    await expect(store.saveRuleVersion("s1", v3)).rejects.toThrow(/already exists/);
  });

  it("keeps one visitor's decisions and rule versions out of another's sandbox", async () => {
    const store = new MemoryStore();
    await store.saveReview("s1", "R-0001", { state: { status: "held", reason: "확인" }, eligibility: null });
    await store.saveRuleVersion("s1", v3);
    expect(await store.getReview("s2", "R-0001")).toBeNull();
    expect(await store.listSavedRuleVersions("s2")).toEqual([]);
    // The same version name is free in another sandbox.
    await expect(store.saveRuleVersion("s2", v3)).resolves.toBeUndefined();
  });

  it("does not create a sandbox just by reading it", async () => {
    const store = new MemoryStore();
    await store.listReviews("never-written");
    expect(await store.listAuditEvents("never-written")).toEqual([]);
  });
});
