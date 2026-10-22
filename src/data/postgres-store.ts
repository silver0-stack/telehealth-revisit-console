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
// Every statement is idempotent. The demo_* tables carry a sandbox id (D33).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS demo_reviews (
     sandbox_id text NOT NULL,
     request_id text NOT NULL,
     record jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (sandbox_id, request_id))`,
  `CREATE TABLE IF NOT EXISTS suggestions (
     request_id text PRIMARY KEY,
     record jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS demo_audit_events (
     sandbox_id text NOT NULL,
     n integer NOT NULL,
     event jsonb NOT NULL,
     PRIMARY KEY (sandbox_id, n))`,
  `CREATE TABLE IF NOT EXISTS demo_rule_versions (
     sandbox_id text NOT NULL,
     seq integer NOT NULL,
     version text NOT NULL,
     entry jsonb NOT NULL,
     PRIMARY KEY (sandbox_id, seq),
     UNIQUE (sandbox_id, version))`,
];

function auditId(n: unknown): string {
  return `A-${String(n).padStart(5, "0")}`;
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

  async getReview(sandbox: string, requestId: string) {
    await this.ready();
    const rows = await this.sql`
      SELECT record FROM demo_reviews WHERE sandbox_id = ${sandbox} AND request_id = ${requestId}`;
    return rows[0] ? ReviewRecordSchema.parse(rows[0].record) : null;
  }

  async listReviews(sandbox: string) {
    await this.ready();
    const rows = await this.sql`SELECT request_id, record FROM demo_reviews WHERE sandbox_id = ${sandbox}`;
    return new Map(rows.map((r) => [String(r.request_id), ReviewRecordSchema.parse(r.record)]));
  }

  async saveReview(sandbox: string, requestId: string, record: ReviewRecord) {
    await this.ready();
    await this.sql`
      INSERT INTO demo_reviews (sandbox_id, request_id, record)
      VALUES (${sandbox}, ${requestId}, ${JSON.stringify(record)}::jsonb)
      ON CONFLICT (sandbox_id, request_id) DO UPDATE SET record = EXCLUDED.record, updated_at = now()`;
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

  async appendAuditEvent(sandbox: string, event: NewAuditEvent, at: string): Promise<AuditEvent> {
    await this.ready();
    // Numbered within the sandbox in one statement. If two writes in the same sandbox race for the same
    // number, the primary key rejects one of them instead of silently giving both the same id.
    const rows = await this.sql`
      INSERT INTO demo_audit_events (sandbox_id, n, event)
      SELECT ${sandbox}, COALESCE(MAX(n), 0) + 1, ${JSON.stringify({ ...event, at })}::jsonb
      FROM demo_audit_events WHERE sandbox_id = ${sandbox}
      RETURNING n`;
    return AuditEventSchema.parse({ ...event, at, id: auditId(rows[0]?.n) });
  }

  async listAuditEvents(sandbox: string) {
    await this.ready();
    const rows = await this.sql`
      SELECT n, event FROM demo_audit_events WHERE sandbox_id = ${sandbox} ORDER BY n DESC`;
    return rows.map((r) => AuditEventSchema.parse({ ...r.event, id: auditId(r.n) }));
  }

  async listSavedRuleVersions(sandbox: string) {
    await this.ready();
    const rows = await this.sql`SELECT entry FROM demo_rule_versions WHERE sandbox_id = ${sandbox} ORDER BY seq`;
    return rows.map((r) => RuleVersionEntrySchema.parse(r.entry));
  }

  async saveRuleVersion(sandbox: string, entry: RuleVersionEntry) {
    await this.ready();
    // The UNIQUE constraint on (sandbox, version) rejects a second "v3" saved at the same moment.
    await this.sql`
      INSERT INTO demo_rule_versions (sandbox_id, seq, version, entry)
      SELECT ${sandbox}, COALESCE(MAX(seq), 0) + 1, ${entry.rules.version}, ${JSON.stringify(entry)}::jsonb
      FROM demo_rule_versions WHERE sandbox_id = ${sandbox}`;
  }
}
