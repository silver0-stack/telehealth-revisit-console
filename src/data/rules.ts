import rulesV1 from "../../config/rules/rules.v1.json" with { type: "json" };
import rulesV2 from "../../config/rules/rules.v2.json" with { type: "json" };
import { RulesSchema, type Rules } from "../domain/rules.ts";

export type RuleVersionEntry = {
  rules: Rules;
  /** "file" = shipped in config/rules; "admin" = saved from the admin screen in this server process. */
  origin: "file" | "admin";
  savedAt: string | null;
  savedBy: string | null;
};

// Parsed once at import time: a broken rules file should stop the app, not produce wrong answers.
// Oldest first; the last entry is the version in force.
// Versions saved from the admin screen live only in memory and disappear on restart (see README).
const entries: RuleVersionEntry[] = [rulesV1, rulesV2].map((raw) => ({
  rules: RulesSchema.parse(raw),
  origin: "file",
  savedAt: null,
  savedBy: null,
}));

export function listRuleVersions(): readonly RuleVersionEntry[] {
  return entries;
}

export function getRules(): Rules {
  const current = entries.at(-1);
  if (!current) throw new Error("No rule versions found in config/rules");
  return current.rules;
}

/**
 * Stores `next` as a new version that takes effect immediately. Versions are never edited in place,
 * so every result recorded with a ruleVersion can be traced back to the exact rules used.
 */
export function saveRuleVersion(next: Omit<Rules, "version">, savedBy: string, now: Date = new Date()): Rules {
  const version = `v${entries.length + 1}`;
  const rules = RulesSchema.parse({ ...next, version });
  entries.push({ rules, origin: "admin", savedAt: now.toISOString(), savedBy });
  return rules;
}
