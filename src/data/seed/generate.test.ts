import { describe, expect, it } from "vitest";
import { DatasetSchema } from "../../domain/types.ts";
import { generateDataset } from "./generate.ts";

const options = { seed: 20261020, today: "2026-10-20", patientCount: 40 };

describe("generateDataset", () => {
  it("is reproducible for the same seed", () => {
    expect(generateDataset(options)).toEqual(generateDataset(options));
  });

  it("changes when the seed changes", () => {
    expect(generateDataset({ ...options, seed: 1 })).not.toEqual(generateDataset(options));
  });

  it("produces data that passes the schema", () => {
    const data = generateDataset(options);
    expect(() => DatasetSchema.parse(data)).not.toThrow();
    expect(data.patients).toHaveLength(40);
  });

  it("never puts a visit after the anchor date", () => {
    const data = generateDataset(options);
    for (const visit of data.visits) {
      expect(visit.date <= options.today).toBe(true);
    }
  });

  it("contains nothing shaped like a phone number or resident registration number", () => {
    const text = JSON.stringify(generateDataset(options));
    expect(text).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    expect(text).not.toMatch(/\d{6}-?[1-4]\d{6}/);
  });
});
