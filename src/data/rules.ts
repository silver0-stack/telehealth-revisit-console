import rulesV1 from "../../config/rules/rules.v1.json" with { type: "json" };
import { RulesSchema, type Rules } from "../domain/rules.ts";

// Parsed once at import time: a broken rules file should stop the app, not produce wrong answers.
const current: Rules = RulesSchema.parse(rulesV1);

export function getRules(): Rules {
  return current;
}
