import { beforeEach, describe, expect, it } from "vitest";
import { appendAuditEvent, listAuditEvents } from "./audit-log.ts";
import { MemoryStore } from "./memory-store.ts";
import { getStore, useStoreForTests } from "./store.ts";

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
    await appendAuditEvent(base, new Date("2026-10-22T01:00:00Z"));
    await appendAuditEvent({ ...base, subject: { type: "request", id: "R-0002" } }, new Date("2026-10-22T02:00:00Z"));
    const [newest, older] = await listAuditEvents();
    expect(newest).toMatchObject({ id: "A-00002", subject: { id: "R-0002" }, at: "2026-10-22T02:00:00.000Z" });
    expect(older?.id).toBe("A-00001");
  });

  it("cannot be changed through the returned list", async () => {
    await appendAuditEvent(base);
    (await listAuditEvents()).pop();
    expect(await listAuditEvents()).toHaveLength(1);
  });

  it("rejects a malformed event instead of storing it", async () => {
    await expect(appendAuditEvent({ ...base, actor: "" })).rejects.toThrow();
    expect(await listAuditEvents()).toHaveLength(0);
  });

  it("keeps counting ids after a demo reset, so an old id never names a different event", async () => {
    await appendAuditEvent(base);
    await getStore().resetDemo();
    expect(await listAuditEvents()).toHaveLength(0);
    expect((await appendAuditEvent(base)).id).toBe("A-00002");
  });
});
