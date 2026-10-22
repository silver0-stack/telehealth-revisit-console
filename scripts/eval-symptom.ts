// Runs every case in eval/cases.jsonl through a symptom matcher and reports how it did.
//   pnpm eval:symptom                    # uses MATCHER from .env.local, default "rules"
//   pnpm eval:symptom --matcher jev      # needs AI_GATEWAY_API_KEY and paid AI Gateway credits
//   pnpm eval:symptom --limit 5          # quick check; results are not saved
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createMatcher, MatcherChoiceSchema } from "../src/ai/index.ts";
import { getAiConfig } from "../src/data/ai-config.ts";
import { toSeoulDate } from "../src/domain/dates.ts";
import type { MatcherInfo } from "../src/domain/symptom.ts";
import { summarize, type Prediction } from "../eval/metrics.ts";

const CaseSchema = z.object({
  id: z.string(),
  previousKcd: z.string(),
  previousNote: z.string(),
  today: z.string().min(1),
  label: z.enum(["same", "related", "different"]),
  tags: z.array(z.string()).min(1),
});

// "npm run x -- --flag" passes a literal "--"; drop it so both styles work.
const args = process.argv.slice(2).filter((a) => a !== "--");
const { values } = parseArgs({ args, options: { matcher: { type: "string" }, limit: { type: "string" } } });
const choice = MatcherChoiceSchema.parse(values.matcher ?? (process.env.MATCHER || "rules"));
const limit = values.limit === undefined ? undefined : z.coerce.number().int().positive().parse(values.limit);

const casesPath = fileURLToPath(new URL("../eval/cases.jsonl", import.meta.url));
const cases = readFileSync(casesPath, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line, i) => {
    const parsed = CaseSchema.safeParse(JSON.parse(line));
    if (!parsed.success) throw new Error(`eval/cases.jsonl line ${i + 1}: ${parsed.error.message}`);
    return parsed.data;
  })
  .slice(0, limit);

const matcher = createMatcher(choice);
const { minConfidence } = getAiConfig();
const predictions: (Prediction & { today: string; previousKcd: string; ms: number })[] = [];
let matcherInfo: MatcherInfo | null = null;

for (const c of cases) {
  const started = performance.now();
  try {
    const m = await matcher.match({ todaySymptom: c.today, previousNote: c.previousNote, previousKcdCode: c.previousKcd });
    matcherInfo ??= m.matcher;
    predictions.push({
      id: c.id,
      tags: c.tags,
      truth: c.label,
      predicted: m.label,
      probabilities: m.probabilities,
      today: c.today,
      previousKcd: c.previousKcd,
      ms: Math.round(performance.now() - started),
    });
  } catch (error) {
    // Stop on the first failure: a half-finished run would report misleading numbers.
    // Only the error's name, status and message are printed, never request headers.
    const e = error as { name?: string; statusCode?: number; message?: string };
    console.error(`Stopped at ${c.id}: ${e.name ?? "Error"} ${e.statusCode ?? ""} ${e.message ?? String(error)}`);
    process.exit(1);
  }
}

const summary = summarize(predictions, minConfidence);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sorted = (ms: number[]) => [...ms].sort((a, b) => a - b);
const latency = sorted(predictions.map((p) => p.ms));
const p50 = latency[Math.floor(latency.length * 0.5)] ?? 0;
const p95 = latency[Math.min(latency.length - 1, Math.floor(latency.length * 0.95))] ?? 0;

console.log(`\nMatcher: ${matcherInfo?.id} (${matcherInfo?.version}) · cases: ${summary.total}`);
console.log(`Accuracy (3 labels): ${pct(summary.accuracy)}`);
console.log(`Latency per case: p50 ${p50} ms · p95 ${p95} ms`);

console.log(`\nPre-selection at minConfidence ${minConfidence} (what the review screen would pre-select):`);
console.log(`  pre-selected ${summary.preselection.preselected}, precision ${pct(summary.preselection.precision)}`);
console.log(`  wrong pre-selections: ${summary.preselection.wrongPreselections.join(", ") || "none"}`);
console.log(`  truly "same" left for the clinician: ${summary.preselection.missedSame}`);

console.log("\nAccuracy by tag:");
for (const [tag, t] of Object.entries(summary.byTag).sort((a, b) => a[1].accuracy - b[1].accuracy)) {
  console.log(`  ${tag.padEnd(13)} n=${String(t.n).padStart(3)}  ${pct(t.accuracy)}`);
}

console.log("\nCalibration (does 'X% sure' mean right X% of the time?):");
console.log("  confidence   n    mean conf.  accuracy");
for (const b of summary.calibration) {
  console.log(`  ${b.range.padEnd(9)} ${String(b.n).padStart(4)}   ${pct(b.meanConfidence).padStart(7)}   ${pct(b.accuracy).padStart(7)}`);
}

console.log("\nMost common confusions (truth -> predicted):");
for (const c of summary.topConfusions.slice(0, 5)) {
  const examples = c.ids.slice(0, 3).map((id) => {
    const p = predictions.find((x) => x.id === id);
    return `${id} "${p?.today}"`;
  });
  console.log(`  ${c.truth} -> ${c.predicted}: ${c.n}   e.g. ${examples.join(", ")}`);
}

if (limit !== undefined) {
  console.log("\n--limit was used, so results were not saved.");
} else {
  const date = toSeoulDate(new Date().toISOString());
  const outDir = fileURLToPath(new URL("../eval/results/", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  const outFile = `${outDir}${date}-${choice}.json`;
  writeFileSync(
    outFile,
    JSON.stringify({ date, matcher: matcherInfo, minConfidence, latencyMs: { p50, p95 }, summary, predictions }, null, 2) + "\n",
  );
  console.log(`\nSaved eval/results/${date}-${choice}.json`);
}
