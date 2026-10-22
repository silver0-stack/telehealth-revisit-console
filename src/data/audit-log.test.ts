import { describe, expect, it } from "vitest";
import { appendAuditEvent, listAuditEvents } from "./audit-log.ts";

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
  it("numbers events and lists the newest first", () => {
    appendAuditEvent(base, new Date("2026-10-22T01:00:00Z"));
    appendAuditEvent({ ...base, subject: { type: "request", id: "R-0002" } }, new Date("2026-10-22T02:00:00Z"));
    const [newest, older] = listAuditEvents();
    expect(newest).toMatchObject({ id: "A-00002", subject: { id: "R-0002" }, at: "2026-10-22T02:00:00.000Z" });
    expect(older?.id).toBe("A-00001");
  });

  it("cannot be changed through the returned list", () => {
    const count = listAuditEvents().length;
    listAuditEvents().pop();
    expect(listAuditEvents()).toHaveLength(count);
  });

  it("rejects a malformed event instead of storing it", () => {
    const count = listAuditEvents().length;
    expect(() => appendAuditEvent({ ...base, actor: "" })).toThrow();
    expect(listAuditEvents()).toHaveLength(count);
  });
});
