import { beforeEach, describe, expect, it } from "vitest";
import { appendAuditEvent, listAuditEvents } from "./audit-log.ts";
import { MemoryStore } from "./memory-store.ts";
import { useStoreForTests } from "./store.ts";

const base = {
  actor: "테스트 의사",
  action: "review.hold" as const,
  subject: { type: "request" as const, id: "R-0001" },
  before: { status: "pending" },
  after: { status: "held", reason: "확인 필요" },
  suggestion: null,
  decision: "보류: 확인 필요",
};

describe("audit log", () => {
  beforeEach(() => useStoreForTests(new MemoryStore()));

  it("numbers events and lists the newest first", async () => {
    await appendAuditEvent("s1", base, new Date("2026-10-22T01:00:00Z"));
    await appendAuditEvent("s1", { ...base, subject: { type: "request", id: "R-0002" } }, new Date("2026-10-22T02:00:00Z"));
    const [newest, older] = await listAuditEvents("s1");
    expect(newest).toMatchObject({ id: "A-00002", subject: { id: "R-0002" }, at: "2026-10-22T02:00:00.000Z" });
    expect(older?.id).toBe("A-00001");
  });

  it("cannot be changed through the returned list", async () => {
    await appendAuditEvent("s1", base);
    (await listAuditEvents("s1")).pop();
    expect(await listAuditEvents("s1")).toHaveLength(1);
  });

  it("rejects a malformed event instead of storing it", async () => {
    await expect(appendAuditEvent("s1", { ...base, actor: "" })).rejects.toThrow();
    expect(await listAuditEvents("s1")).toHaveLength(0);
  });

  it("keeps each sandbox's log separate, numbered from A-00001", async () => {
    await appendAuditEvent("s1", base);
    await appendAuditEvent("s1", base);
    expect((await appendAuditEvent("s2", base)).id).toBe("A-00001");
    expect(await listAuditEvents("s1")).toHaveLength(2);
    expect(await listAuditEvents("s2")).toHaveLength(1);
  });
});
