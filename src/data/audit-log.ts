import type { AuditEvent } from "../domain/audit.ts";
import { getStore, NewAuditEventSchema, type NewAuditEvent } from "./store.ts";

// Append-only. There is deliberately no update or delete function: an audit log that can be edited
// is not an audit log. Even the demo reset does not delete: it starts a new sandbox (D33).

export async function appendAuditEvent(sandbox: string, event: NewAuditEvent, now: Date = new Date()): Promise<AuditEvent> {
  // Validate before storing, so a malformed event is refused instead of written.
  return getStore().appendAuditEvent(sandbox, NewAuditEventSchema.parse(event), now.toISOString());
}

/** Newest first. */
export async function listAuditEvents(sandbox: string): Promise<AuditEvent[]> {
  return getStore().listAuditEvents(sandbox);
}
