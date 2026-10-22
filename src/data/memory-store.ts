import type { AuditEvent } from "../domain/audit.ts";
import type { NewAuditEvent, ReviewRecord, RuleVersionEntry, Store, SuggestionRecord } from "./store.ts";

type Sandbox = {
  reviews: Map<string, ReviewRecord>;
  events: AuditEvent[];
  ruleVersions: RuleVersionEntry[];
};

// Lives in the server process and disappears on restart. Used for local runs, unit tests and E2E.
export class MemoryStore implements Store {
  private readonly sandboxes = new Map<string, Sandbox>();
  private readonly suggestions = new Map<string, SuggestionRecord>();

  // Reading a sandbox that was never written returns an empty one without creating it.
  private read(sandbox: string): Sandbox {
    return this.sandboxes.get(sandbox) ?? { reviews: new Map(), events: [], ruleVersions: [] };
  }

  private write(sandbox: string): Sandbox {
    let s = this.sandboxes.get(sandbox);
    if (!s) {
      s = { reviews: new Map(), events: [], ruleVersions: [] };
      this.sandboxes.set(sandbox, s);
    }
    return s;
  }

  async getReview(sandbox: string, requestId: string) {
    return this.read(sandbox).reviews.get(requestId) ?? null;
  }

  async listReviews(sandbox: string) {
    return new Map(this.read(sandbox).reviews);
  }

  async saveReview(sandbox: string, requestId: string, record: ReviewRecord) {
    this.write(sandbox).reviews.set(requestId, record);
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

  async appendAuditEvent(sandbox: string, event: NewAuditEvent, at: string) {
    const s = this.write(sandbox);
    const entry: AuditEvent = { ...event, id: `A-${String(s.events.length + 1).padStart(5, "0")}`, at };
    s.events.push(entry);
    return entry;
  }

  async listAuditEvents(sandbox: string) {
    return [...this.read(sandbox).events].reverse();
  }

  async listSavedRuleVersions(sandbox: string) {
    return [...this.read(sandbox).ruleVersions];
  }

  async saveRuleVersion(sandbox: string, entry: RuleVersionEntry) {
    const s = this.write(sandbox);
    if (s.ruleVersions.some((e) => e.rules.version === entry.rules.version)) {
      throw new Error(`Rule version ${entry.rules.version} already exists`);
    }
    s.ruleVersions.push(entry);
  }
}
