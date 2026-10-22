import { z } from "zod";

// Shape of config/rules/*.json. Every rule value lives in these files, never in components,
// so a new rule version is a new file that can be diffed against the old one (M5).

export const PeriodSchema = z.object({
  amount: z.number().int().positive(),
  unit: z.enum(["day", "month"]),
});
export type Period = z.infer<typeof PeriodSchema>;

export const RulesSchema = z.object({
  version: z.string().min(1),
  /** Where the values come from, so a reviewer can check them. */
  source: z.string().min(1),
  // Human-readable list of placeholder values in this file; mirrors docs/ASSUMPTIONS.md.
  assumptions: z.array(z.string()),
  followUp: z.object({
    // ASSUMPTION (A1): length of the window after the last same-symptom in-person visit.
    window: PeriodSchema,
  }),
  firstVisit: z.object({
    // When false, first-visit telehealth is allowed regardless of region (old pilot-style rules).
    requireSameRegion: z.boolean(),
    // Patient categories allowed to use first-visit telehealth outside their region.
    outsideRegionExceptions: z.array(z.string().regex(/^[a-z0-9_]+$/)),
  }),
});
export type Rules = z.infer<typeof RulesSchema>;
