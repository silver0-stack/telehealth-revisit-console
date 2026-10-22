import { z } from "zod";
import { IsoDateTimeSchema } from "./types.ts";

// One entry per human decision. Entries are append-only: nothing in the app edits or deletes them.

export const AuditActionSchema = z.enum(["review.approve", "review.edit_approve", "review.hold", "rules.save"]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

const ProbabilitiesSchema = z.object({ same: z.number(), related: z.number(), different: z.number() });

/** The automatic suggestion as the clinician saw it when deciding. */
export const AuditSuggestionSchema = z.object({
  outcome: z.enum(["preselect", "needs_review", "no_candidates"]),
  visitId: z.string().nullable(),
  kcdCode: z.string().nullable(),
  label: z.enum(["same", "related", "different"]).nullable(),
  probabilities: ProbabilitiesSchema.nullable(),
  matcher: z.object({ kind: z.enum(["rules", "ai"]), id: z.string(), version: z.string() }).nullable(),
  minConfidence: z.number(),
});
export type AuditSuggestion = z.infer<typeof AuditSuggestionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().regex(/^A-\d{5}$/),
  at: IsoDateTimeSchema,
  actor: z.string().min(1),
  action: AuditActionSchema,
  subject: z.object({ type: z.enum(["request", "rules"]), id: z.string() }),
  before: z.json().nullable(),
  after: z.json().nullable(),
  suggestion: AuditSuggestionSchema.nullable(),
  /** The clinician's decision in plain terms, e.g. the confirmed KCD code or the hold reason. */
  decision: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
