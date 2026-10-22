import { describe, expect, it } from "vitest";
import { getRules, listRuleVersions } from "./rules.ts";

describe("rules config", () => {
  it("uses the newest version as the current rules", () => {
    expect(getRules().version).toBe("v2");
    expect(listRuleVersions().map((r) => r.version)).toEqual(["v1", "v2"]);
  });

  it("every version says where its values come from and what is assumed", () => {
    for (const rules of listRuleVersions()) {
      expect(rules.source.length).toBeGreaterThan(0);
      expect(rules.assumptions.length).toBeGreaterThan(0);
    }
  });
});
