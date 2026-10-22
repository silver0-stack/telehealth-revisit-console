import rulesV1 from "../../config/rules/rules.v1.json" with { type: "json" };
import rulesV2 from "../../config/rules/rules.v2.json" with { type: "json" };
import { RulesSchema, type Rules } from "../domain/rules.ts";

// Parsed once at import time: a broken rules file should stop the app, not produce wrong answers.
// Oldest first; the last entry is the version in force.
const versions: readonly Rules[] = [rulesV1, rulesV2].map((raw) => RulesSchema.parse(raw));

export function listRuleVersions(): readonly Rules[] {
  return versions;
}

export function getRules(): Rules {
  const current = versions.at(-1);
  if (!current) throw new Error("No rule versions found in config/rules");
  return current;
}
