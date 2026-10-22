import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store.ts";
import { getRules, listRuleVersions, saveRuleVersion } from "./rules.ts";
import { useStoreForTests } from "./store.ts";

describe("rules store", () => {
  beforeEach(() => useStoreForTests(new MemoryStore()));

  it("starts with the shipped files and uses the newest as current", async () => {
    expect((await listRuleVersions()).map((e) => e.rules.version)).toEqual(["v1", "v2"]);
    expect((await getRules()).version).toBe("v2");
  });

  it("every shipped version says where its values come from and what is assumed", async () => {
    for (const { rules } of await listRuleVersions()) {
      expect(rules.source.length).toBeGreaterThan(0);
      expect(rules.assumptions.length).toBeGreaterThan(0);
    }
  });

  it("saves an edit as a new version without changing the old one", async () => {
    // Passing the whole current rules is fine: saveRuleVersion assigns the new version number itself.
    const rest = await getRules();
    const saved = await saveRuleVersion(
      { ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["DRG-002"] } },
      "테스트 관리자",
      new Date("2026-10-22T03:00:00Z"),
    );
    expect(saved.version).toBe("v3");
    expect((await getRules()).prescription.blockedDrugCodes).toEqual(["DRG-002"]);
    const versions = await listRuleVersions();
    expect(versions[1]?.rules.prescription.blockedDrugCodes).toEqual([]);
    expect(versions[2]).toMatchObject({ origin: "admin", savedBy: "테스트 관리자" });
  });

  it("refuses invalid rules instead of storing them", async () => {
    const rest = await getRules();
    await expect(
      saveRuleVersion({ ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["not-a-code"] } }, "x"),
    ).rejects.toThrow();
    expect(await listRuleVersions()).toHaveLength(2);
  });
});
