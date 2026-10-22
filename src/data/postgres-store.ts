import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { AuditEventSchema, type AuditEvent } from "../domain/audit.ts";
import {
  ReviewRecordSchema,
  RuleVersionEntrySchema,
  SuggestionRecordSchema,
  type NewAuditEvent,
  type ReviewRecord,
  type RuleVersionEntry,
  type Store,
  type SuggestionRecord,
} from "./store.ts";

// Neon Postgres over HTTP (`neon()`), which suits serverless functions: no connection to keep open
// between requests. Records are stored as JSONB and validated with zod when read back, because the
// database is outside the process and could hold rows written by an older version of the app.

// Created on first use, so a fresh Neon database (or a preview branch) works without a setup step.
// Every statement is idempotent. Audit ids come from an identity column that is never reset.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reviews (
     request_id text PRIMARY KEY,
     record jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS suggestions (
     request_id text PRIMARY KEY,
     record jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS audit_events (
     seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     event jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rule_versions (
     seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     version text NOT NULL UNIQUE,
     entry jsonb NOT NULL)`,
];

function auditId(seq: unknown): string {
  return `A-${String(seq).padStart(5, "0")}`;
}

export class PostgresStore implements Store {
  private readonly sql: NeonQueryFunction<false, false>;
  private schemaReady: Promise<void> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private ready(): Promise<void> {
    this.schemaReady ??= this.sql.transaction(SCHEMA.map((statement) => this.sql.query(statement))).then(
      () => undefined,
      (error: unknown) => {
        // Do not remember a failure: the next request tries again (e.g. after the database wakes up).
        this.schemaReady = undefined;
        throw error;
      },
    );
    return this.schemaReady;
  }

  async getReview(requestId: string) {
    await this.ready();
    const rows = await this.sql`SELECT record FROM reviews WHERE request_id = ${requestId}`;
    return rows[0] ? ReviewRecordSchema.parse(rows[0].record) : null;
  }

  async listReviews() {
    await this.ready();
    const rows = await this.sql`SELECT request_id, record FROM reviews`;
    return new Map(rows.map((r) => [String(r.request_id), ReviewRecordSchema.parse(r.record)]));
  }

  async saveReview(requestId: string, record: ReviewRecord) {
    await this.ready();
    await this.sql`
      INSERT INTO reviews (request_id, record) VALUES (${requestId}, ${JSON.stringify(record)}::jsonb)
      ON CONFLICT (request_id) DO UPDATE SET record = EXCLUDED.record, updated_at = now()`;
  }

  async getSuggestion(requestId: string) {
    await this.ready();
    const rows = await this.sql`SELECT record FROM suggestions WHERE request_id = ${requestId}`;
    return rows[0] ? SuggestionRecordSchema.parse(rows[0].record) : null;
  }

  async saveSuggestion(requestId: string, record: SuggestionRecord) {
    await this.ready();
    // Two instances may compute the same suggestion at once. The first insert wins and both return it,
    // so the screen and the audit log always refer to one stored suggestion.
    await this.sql`
      INSERT INTO suggestions (request_id, record) VALUES (${requestId}, ${JSON.stringify(record)}::jsonb)
      ON CONFLICT (request_id) DO NOTHING`;
    const stored = await this.getSuggestion(requestId);
    if (!stored) throw new Error(`Suggestion for ${requestId} was not stored`);
    return stored;
  }

  async appendAuditEvent(event: NewAuditEvent, at: string): Promise<AuditEvent> {
    await this.ready();
    const rows = await this.sql`
      INSERT INTO audit_events (event) VALUES (${JSON.stringify({ ...event, at })}::jsonb) RETURNING seq`;
    return AuditEventSchema.parse({ ...event, at, id: auditId(rows[0]?.seq) });
  }

  async listAuditEvents() {
    await this.ready();
    const rows = await this.sql`SELECT seq, event FROM audit_events ORDER BY seq DESC`;
    return rows.map((r) => AuditEventSchema.parse({ ...r.event, id: auditId(r.seq) }));
  }

  async listSavedRuleVersions() {
    await this.ready();
    const rows = await this.sql`SELECT entry FROM rule_versions ORDER BY seq`;
    return rows.map((r) => RuleVersionEntrySchema.parse(r.entry));
  }

  async saveRuleVersion(entry: RuleVersionEntry) {
    await this.ready();
    // The UNIQUE constraint on version rejects a second "v3" saved at the same moment.
    await this.sql`
      INSERT INTO rule_versions (version, entry) VALUES (${entry.rules.version}, ${JSON.stringify(entry)}::jsonb)`;
  }

  async resetDemo() {
    await this.ready();
    await this.sql.transaction([
      this.sql`DELETE FROM reviews`,
      this.sql`DELETE FROM audit_events`,
      this.sql`DELETE FROM rule_versions`,
    ]);
  }
}
