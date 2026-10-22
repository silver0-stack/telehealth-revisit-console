import { z } from "zod";
import { AuditEventSchema, type AuditEvent } from "../domain/audit.ts";
import { EligibilityResultSchema } from "../domain/eligibility.ts";
import { ReviewStateSchema } from "../domain/review.ts";
import { RulesSchema } from "../domain/rules.ts";
import { MatchCandidateSchema, SuggestionSchema } from "../domain/symptom.ts";
import { MemoryStore } from "./memory-store.ts";
import { PostgresStore } from "./postgres-store.ts";

// Everything the app writes while running: review decisions, stored suggestions, the audit log and
// rule versions saved from the admin screen. Patient records stay in RecordSource (read-only seed).
// The memory store keeps local runs and tests free of any service; the Postgres store is for the
// deployed demo, where several server instances must see the same state.
//
// Decisions, the audit log and saved rule versions belong to a sandbox: the public demo gives each
// visitor their own, so one visitor can never change or erase what another sees (D33).
// Suggestions are shared: they depend only on the request, and sharing them keeps AI calls to one per request.

export const ReviewRecordSchema = z.object({
  state: ReviewStateSchema,
  /** Set when approved: eligibility computed from the clinician-confirmed code. */
  eligibility: EligibilityResultSchema.nullable(),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const SuggestionRecordSchema = z.object({
  suggestion: SuggestionSchema,
  candidates: z.array(MatchCandidateSchema),
  minConfidence: z.number(),
});
export type SuggestionRecord = z.infer<typeof SuggestionRecordSchema>;

export const RuleVersionEntrySchema = z.object({
  rules: RulesSchema,
  /** "file" = shipped in config/rules; "admin" = saved from the admin screen. */
  origin: z.enum(["file", "admin"]),
  savedAt: z.string().nullable(),
  savedBy: z.string().nullable(),
});
export type RuleVersionEntry = z.infer<typeof RuleVersionEntrySchema>;

export const NewAuditEventSchema = AuditEventSchema.omit({ id: true, at: true });
export type NewAuditEvent = z.infer<typeof NewAuditEventSchema>;

export interface Store {
  getReview(sandbox: string, requestId: string): Promise<ReviewRecord | null>;
  listReviews(sandbox: string): Promise<Map<string, ReviewRecord>>;
  saveReview(sandbox: string, requestId: string, record: ReviewRecord): Promise<void>;

  getSuggestion(requestId: string): Promise<SuggestionRecord | null>;
  /** Keeps the first record saved for a request and returns whichever one is stored. */
  saveSuggestion(requestId: string, record: SuggestionRecord): Promise<SuggestionRecord>;

  /** Numbers the event within its sandbox (A-00001, ...) and stores it. There is no update or delete. */
  appendAuditEvent(sandbox: string, event: NewAuditEvent, at: string): Promise<AuditEvent>;
  /** Newest first. */
  listAuditEvents(sandbox: string): Promise<AuditEvent[]>;

  /** Admin-saved versions only, oldest first. */
  listSavedRuleVersions(sandbox: string): Promise<RuleVersionEntry[]>;
  /** Fails if the version name is already taken in this sandbox, so two saves cannot both become "v3". */
  saveRuleVersion(sandbox: string, entry: RuleVersionEntry): Promise<void>;
}

export const StoreChoiceSchema = z.enum(["memory", "postgres"]);

let store: Store | undefined;

// STORE=memory (default) needs nothing; STORE=postgres needs DATABASE_URL. Chosen explicitly instead of
// "use the database whenever DATABASE_URL exists", so a local .env.local with a database URL can never
// make the E2E run (which sets STORE=memory) write to the shared demo database.
export function getStore(): Store {
  if (store) return store;
  const choice = StoreChoiceSchema.default("memory").parse(process.env.STORE || undefined);
  if (choice === "memory") {
    store = new MemoryStore();
  } else {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("STORE=postgres needs DATABASE_URL. Set STORE=memory to run without a database.");
    store = new PostgresStore(url);
  }
  return store;
}

/** Tests only: start from an empty memory store. */
export function useStoreForTests(next: Store): void {
  store = next;
}
