import { describe, expect, it } from "vitest";
import { can, DEFAULT_ROLE, RoleSchema } from "./roles.ts";

describe("roles", () => {
  it("lets only a doctor decide a review", () => {
    expect(can("doctor", "review.decide")).toBe(true);
    expect(can("admin", "review.decide")).toBe(false);
  });

  it("lets only an admin save rules or reset the demo", () => {
    for (const permission of ["rules.save", "demo.reset"] as const) {
      expect(can("admin", permission)).toBe(true);
      expect(can("doctor", permission)).toBe(false);
    }
  });

  it("starts as a doctor, the role most visitors want to try", () => {
    expect(DEFAULT_ROLE).toBe("doctor");
  });

  it("rejects an unknown role instead of guessing", () => {
    expect(RoleSchema.safeParse("nurse").success).toBe(false);
  });
});
