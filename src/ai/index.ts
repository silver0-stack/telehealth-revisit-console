import { z } from "zod";
import { getAiConfig } from "../data/ai-config.ts";
import { JevMatcher } from "./jev-matcher.ts";
import { RuleBasedMatcher } from "./rule-based-matcher.ts";
import type { SymptomMatcher } from "./symptom-matcher.ts";

export const MatcherChoiceSchema = z.enum(["rules", "jev"]);
export type MatcherChoice = z.infer<typeof MatcherChoiceSchema>;

export function createMatcher(choice: MatcherChoice): SymptomMatcher {
  if (choice === "rules") return new RuleBasedMatcher();
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("MATCHER=jev needs AI_GATEWAY_API_KEY in .env.local. Set MATCHER=rules to run without AI.");
  }
  return new JevMatcher(getAiConfig().jevModel);
}

let matcher: SymptomMatcher | undefined;

// MATCHER=rules needs no network or key, so the whole app works without the AI (hard rule 4).
export function getSymptomMatcher(): SymptomMatcher {
  matcher ??= createMatcher(MatcherChoiceSchema.default("rules").parse(process.env.MATCHER || undefined));
  return matcher;
}
