# Assumptions

Korea's revised Medical Act on telehealth takes effect 2026-12-24, but the detailed criteria are still being
set by decree and Ministry of Health and Welfare notices. Every number below is a **placeholder**.
Each one is tagged `ASSUMPTION` in code and must be checked before any real use.

| ID | Assumption | Where in code | What to verify | Where to verify |
|----|------------|---------------|----------------|-----------------|
| A1 | Re-visit window is 30 days (`revisitWindowDays: 30`) | `config/rules/rules.v1.json` (added in M1) | The actual window, and whether it differs by condition or patient group | Enforcement Decree of the Medical Act; MOHW notices on 비대면 진료 |
| A2 | Only an `in_person` visit for the same symptom at the same clinic counts | `src/domain/eligibility.ts` (M1) | Whether a prior telehealth visit or another clinic's visit can count | Same as A1 |

Rows are added as new assumptions appear (restricted drug list in M2, AI confidence threshold in M4).
