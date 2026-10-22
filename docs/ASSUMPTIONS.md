# Assumptions

Korea's revised Medical Act on telehealth takes effect 2026-12-24, but the detailed criteria are still being
set by decree and Ministry of Health and Welfare notices. Every number below is a **placeholder**.
Each one is tagged `ASSUMPTION` in code and must be checked before any real use.

| ID | Assumption | Where in code | What to verify | Where to verify |
|----|------------|---------------|----------------|-----------------|
| A1 | Re-visit window is 30 days (`revisitWindowDays: 30`) | `config/rules/rules.v1.json` | The actual window, and whether it differs by condition or patient group | Enforcement Decree of the Medical Act; MOHW notices on 비대면 진료 |
| A2 | Only an `in_person` visit for the same symptom at the same clinic counts | `src/domain/eligibility.ts` | Whether a prior telehealth visit or another clinic's visit can count | Same as A1 |
| A3 | The boundary day counts: a visit exactly `revisitWindowDays` days before the request is still inside the window | `src/domain/eligibility.ts` | Whether the window is inclusive, and whether it counts from the visit day or the next day | Same as A1 |
| A4 | Days are counted as Asia/Seoul calendar days between the visit date and the request date | `src/domain/eligibility.ts`, `src/domain/dates.ts` | Whether the law counts calendar days, 24-hour periods, or business days | Same as A1 |
| A5 | "Same clinic" is implied because the app models one clinic; other clinics' visits are never stored | `src/domain/eligibility.ts` | Whether a visit at a related clinic (same group or referral) can count | Same as A1 |

Rows are added as new assumptions appear (restricted drug list in M2, AI confidence threshold in M4).
