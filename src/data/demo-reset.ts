import type { AuditEvent } from "../domain/audit.ts";
import { appendAuditEvent } from "./audit-log.ts";

// Resetting does not delete anything: the visitor moves to a new, empty sandbox (D33), and the reset
// is logged as the first entry there, so the starting point of the new log is never unexplained.
export async function logDemoReset(newSandbox: string, actor: string): Promise<AuditEvent> {
  return appendAuditEvent(newSandbox, {
    actor,
    action: "demo.reset",
    subject: { type: "demo", id: "reset" },
    before: null,
    after: null,
    suggestion: null,
    decision: "새 데모 공간에서 처음부터 시작했어요. 다른 방문자의 기록에는 영향이 없어요.",
  });
}
