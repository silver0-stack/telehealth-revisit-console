import { z } from "zod";

// Shape of config/rules/*.json. Every rule value lives in these files, never in components,
// so a new rule version is a new file that can be diffed against the old one (M5).
export const RulesSchema = z.object({
  version: z.string().min(1),
  // Human-readable list of placeholder values in this file; mirrors docs/ASSUMPTIONS.md.
  assumptions: z.array(z.string()),
  eligibility: z.object({
    // ASSUMPTION (A1): the real window is not yet set by decree.
    revisitWindowDays: z.number().int().positive(),
  }),
});
export type Rules = z.infer<typeof RulesSchema>;
