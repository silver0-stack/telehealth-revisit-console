import type { AuditEvent } from "../domain/audit.ts";
import { getStore, NewAuditEventSchema, type NewAuditEvent } from "./store.ts";

// Append-only. There is deliberately no update or delete function: an audit log that can be edited
// is not an audit log. (The demo's reset button is the one exception, and it is itself logged.)

export async function appendAuditEvent(event: NewAuditEvent, now: Date = new Date()): Promise<AuditEvent> {
  // Validate before storing, so a malformed event is refused instead of written.
  return getStore().appendAuditEvent(NewAuditEventSchema.parse(event), now.toISOString());
}

/** Newest first. */
export async function listAuditEvents(): Promise<AuditEvent[]> {
  return getStore().listAuditEvents();
}
