import { describe, expect, it } from "vitest";
import { getRules, listRuleVersions, saveRuleVersion } from "./rules.ts";

describe("rules store", () => {
  it("starts with the shipped files and uses the newest as current", () => {
    expect(listRuleVersions().map((e) => e.rules.version)).toEqual(["v1", "v2"]);
    expect(getRules().version).toBe("v2");
  });

  it("every shipped version says where its values come from and what is assumed", () => {
    for (const { rules } of listRuleVersions()) {
      expect(rules.source.length).toBeGreaterThan(0);
      expect(rules.assumptions.length).toBeGreaterThan(0);
    }
  });

  it("saves an edit as a new version without changing the old one", () => {
    // Passing the whole current rules is fine: saveRuleVersion assigns the new version number itself.
    const rest = getRules();
    const saved = saveRuleVersion(
      { ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["DRG-002"] } },
      "테스트 관리자",
      new Date("2026-10-22T03:00:00Z"),
    );
    expect(saved.version).toBe("v3");
    expect(getRules().prescription.blockedDrugCodes).toEqual(["DRG-002"]);
    expect(listRuleVersions()[1]?.rules.prescription.blockedDrugCodes).toEqual([]);
    expect(listRuleVersions()[2]).toMatchObject({ origin: "admin", savedBy: "테스트 관리자" });
  });

  it("refuses invalid rules instead of storing them", () => {
    const rest = getRules();
    const count = listRuleVersions().length;
    expect(() =>
      saveRuleVersion({ ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["not-a-code"] } }, "x"),
    ).toThrow();
    expect(listRuleVersions()).toHaveLength(count);
  });
});
