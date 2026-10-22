import type { AuditEvent } from "../domain/audit.ts";
import type { NewAuditEvent, ReviewRecord, RuleVersionEntry, Store, SuggestionRecord } from "./store.ts";

// Lives in the server process and disappears on restart. Used for local runs, unit tests and E2E.
export class MemoryStore implements Store {
  private readonly reviews = new Map<string, ReviewRecord>();
  private readonly suggestions = new Map<string, SuggestionRecord>();
  private readonly events: AuditEvent[] = [];
  private readonly ruleVersions: RuleVersionEntry[] = [];
  // Ids keep counting after a reset, like the database sequence would without RESTART IDENTITY.
  private nextEventNumber = 1;

  async getReview(requestId: string) {
    return this.reviews.get(requestId) ?? null;
  }

  async listReviews() {
    return new Map(this.reviews);
  }

  async saveReview(requestId: string, record: ReviewRecord) {
    this.reviews.set(requestId, record);
  }

  async getSuggestion(requestId: string) {
    return this.suggestions.get(requestId) ?? null;
  }

  async saveSuggestion(requestId: string, record: SuggestionRecord) {
    const existing = this.suggestions.get(requestId);
    if (existing) return existing;
    this.suggestions.set(requestId, record);
    return record;
  }

  async appendAuditEvent(event: NewAuditEvent, at: string) {
    const entry: AuditEvent = { ...event, id: `A-${String(this.nextEventNumber++).padStart(5, "0")}`, at };
    this.events.push(entry);
    return entry;
  }

  async listAuditEvents() {
    return [...this.events].reverse();
  }

  async listSavedRuleVersions() {
    return [...this.ruleVersions];
  }

  async saveRuleVersion(entry: RuleVersionEntry) {
    if (this.ruleVersions.some((e) => e.rules.version === entry.rules.version)) {
      throw new Error(`Rule version ${entry.rules.version} already exists`);
    }
    this.ruleVersions.push(entry);
  }

  async resetDemo() {
    this.reviews.clear();
    this.events.length = 0;
    this.ruleVersions.length = 0;
  }
}
