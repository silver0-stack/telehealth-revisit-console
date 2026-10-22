import type { AuditEvent } from "../domain/audit.ts";
import { appendAuditEvent } from "./audit-log.ts";
import { getStore } from "./store.ts";

// The deployed demo is public, so visitors can approve every request. Resetting brings back the
// starting state. The reset is logged as the first entry of the new log, so it is never invisible.
export async function resetDemo(actor: string): Promise<AuditEvent> {
  await getStore().resetDemo();
  return appendAuditEvent({
    actor,
    action: "demo.reset",
    subject: { type: "demo", id: "reset" },
    before: null,
    after: null,
    suggestion: null,
    decision: "검토 결정, 감사 로그, 관리자가 저장한 규칙 버전을 지웠어요. AI 제안은 남겨 두었어요.",
  });
}
