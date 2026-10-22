import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store.ts";
import { getRules, listRuleVersions, saveRuleVersion } from "./rules.ts";
import { useStoreForTests } from "./store.ts";

describe("rules store", () => {
  beforeEach(() => useStoreForTests(new MemoryStore()));

  it("starts with the shipped files and uses the newest as current", async () => {
    expect((await listRuleVersions("s1")).map((e) => e.rules.version)).toEqual(["v1", "v2"]);
    expect((await getRules("s1")).version).toBe("v2");
  });

  it("every shipped version says where its values come from and what is assumed", async () => {
    for (const { rules } of await listRuleVersions("s1")) {
      expect(rules.source.length).toBeGreaterThan(0);
      expect(rules.assumptions.length).toBeGreaterThan(0);
    }
  });

  it("saves an edit as a new version without changing the old one", async () => {
    // Passing the whole current rules is fine: saveRuleVersion assigns the new version number itself.
    const rest = await getRules("s1");
    const saved = await saveRuleVersion(
      "s1",
      { ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["DRG-002"] } },
      "테스트 관리자",
      new Date("2026-10-22T03:00:00Z"),
    );
    expect(saved.version).toBe("v3");
    expect((await getRules("s1")).prescription.blockedDrugCodes).toEqual(["DRG-002"]);
    const versions = await listRuleVersions("s1");
    expect(versions[1]?.rules.prescription.blockedDrugCodes).toEqual([]);
    expect(versions[2]).toMatchObject({ origin: "admin", savedBy: "테스트 관리자" });
  });

  it("refuses invalid rules instead of storing them", async () => {
    const rest = await getRules("s1");
    await expect(
      saveRuleVersion("s1", { ...rest, prescription: { ...rest.prescription, blockedDrugCodes: ["not-a-code"] } }, "x"),
    ).rejects.toThrow();
    expect(await listRuleVersions("s1")).toHaveLength(2);
  });
});
