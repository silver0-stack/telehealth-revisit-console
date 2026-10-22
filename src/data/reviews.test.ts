import { describe, expect, it } from "vitest";
import type { Visit } from "../domain/types.ts";
import { comparisonVisits } from "./reviews.ts";

function visit(id: string, date: string, kcdCode: string, mode: Visit["mode"] = "in_person"): Visit {
  return { id, patientId: "P-0001", date, mode, kcdCode, note: "" };
}

describe("comparisonVisits", () => {
  it("keeps only the latest in-person visit per code, newest first", () => {
    const visits = [
      visit("V-00001", "2026-03-01", "J02.9"),
      visit("V-00002", "2026-08-01", "J02.9"),
      visit("V-00003", "2026-09-01", "M54.5"),
      visit("V-00004", "2026-10-01", "I10", "telehealth"),
    ];
    expect(comparisonVisits(visits, "2026-10-20").map((v) => v.id)).toEqual(["V-00003", "V-00002"]);
  });

  it("ignores visits after the request date", () => {
    expect(comparisonVisits([visit("V-00001", "2026-10-21", "J02.9")], "2026-10-20")).toEqual([]);
  });
});
