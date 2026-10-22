import rulesV1 from "../../config/rules/rules.v1.json" with { type: "json" };
import rulesV2 from "../../config/rules/rules.v2.json" with { type: "json" };
import { RulesSchema, type Rules } from "../domain/rules.ts";
import { getStore, type RuleVersionEntry } from "./store.ts";

export type { RuleVersionEntry } from "./store.ts";

// Parsed once at import time: a broken rules file should stop the app, not produce wrong answers.
const fileEntries: readonly RuleVersionEntry[] = [rulesV1, rulesV2].map((raw) => ({
  rules: RulesSchema.parse(raw),
  origin: "file",
  savedAt: null,
  savedBy: null,
}));

/** Shipped files first, then versions saved in this sandbox. Oldest first; the last is in force. */
export async function listRuleVersions(sandbox: string): Promise<RuleVersionEntry[]> {
  return [...fileEntries, ...(await getStore().listSavedRuleVersions(sandbox))];
}

export async function getRules(sandbox: string): Promise<Rules> {
  const current = (await listRuleVersions(sandbox)).at(-1);
  if (!current) throw new Error("No rule versions found in config/rules");
  return current.rules;
}

/**
 * Stores `next` as a new version that takes effect immediately. Versions are never edited in place,
 * so every result recorded with a ruleVersion can be traced back to the exact rules used.
 */
export async function saveRuleVersion(
  sandbox: string,
  next: Omit<Rules, "version">,
  savedBy: string,
  now: Date = new Date(),
): Promise<Rules> {
  const version = `v${(await listRuleVersions(sandbox)).length + 1}`;
  const rules = RulesSchema.parse({ ...next, version });
  await getStore().saveRuleVersion(sandbox, { rules, origin: "admin", savedAt: now.toISOString(), savedBy });
  return rules;
}
