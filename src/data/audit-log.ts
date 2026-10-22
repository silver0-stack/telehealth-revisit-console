import { AuditEventSchema, type AuditEvent } from "../domain/audit.ts";

// Append-only, in memory for the demo (resets on restart, see README). There is deliberately
// no update or delete function: an audit log that can be edited is not an audit log.
const events: AuditEvent[] = [];

export function appendAuditEvent(event: Omit<AuditEvent, "id" | "at">, now: Date = new Date()): AuditEvent {
  const entry = AuditEventSchema.parse({
    ...event,
    id: `A-${String(events.length + 1).padStart(5, "0")}`,
    at: now.toISOString(),
  });
  events.push(entry);
  return entry;
}

/** Newest first. Returns a copy so callers cannot change the log. */
export function listAuditEvents(): AuditEvent[] {
  return [...events].reverse();
}
