import { z } from "zod";
import { RuleBasedMatcher } from "./rule-based-matcher.ts";
import type { SymptomMatcher } from "./symptom-matcher.ts";

const MatcherEnvSchema = z.enum(["rules", "jev"]).default("rules");

let matcher: SymptomMatcher | undefined;

// MATCHER=rules needs no network or key, so the whole app works without the AI (hard rule 4).
export function getSymptomMatcher(): SymptomMatcher {
  if (matcher) return matcher;
  const choice = MatcherEnvSchema.parse(process.env.MATCHER || undefined);
  if (choice === "jev") {
    throw new Error("MATCHER=jev is not available yet (added in M4). Set MATCHER=rules in .env.local.");
  }
  matcher = new RuleBasedMatcher();
  return matcher;
}
