// Regenerates src/data/seed.json. Runs on Node's built-in TypeScript support
// (no tsx/ts-node), which is why imports below use explicit `.ts` extensions.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CLINIC } from "../src/data/clinic.ts";
import { generateDataset } from "../src/data/seed/generate.ts";
import { DatasetSchema } from "../src/domain/types.ts";

// Fixed values keep the demo reproducible. Change the seed only on purpose.
const SEED = 20261020;
const TODAY = "2026-10-20";
const PATIENT_COUNT = 40;

const dataset = DatasetSchema.parse(generateDataset({ seed: SEED, today: TODAY, patientCount: PATIENT_COUNT, clinicRegion: CLINIC.region }));
const outPath = fileURLToPath(new URL("../src/data/seed.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(dataset, null, 2) + "\n", "utf8");

console.log(
  `Wrote ${dataset.patients.length} patients, ${dataset.visits.length} visits, ` +
    `${dataset.requests.length} requests to src/data/seed.json`,
);
