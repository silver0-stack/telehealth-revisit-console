import type { Sido } from "../domain/types.ts";

// The demo models a single, fictional 의원-level clinic.
// ASSUMPTION (A9): it is 의원급, so the stricter 병원급 limits (draft 제31조의4) do not apply.
export const CLINIC = {
  name: "가상의원 (데모)",
  region: "서울특별시",
} as const satisfies { name: string; region: Sido };
