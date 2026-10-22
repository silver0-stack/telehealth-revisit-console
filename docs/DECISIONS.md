# Decisions

Each entry: what we chose, why, and what we gave up. Newest at the bottom.

## D1. pnpm 10 via corepack, not pnpm 12 (2026-10-22)
pnpm 12 ships its entry point as `bin/pnpm.mjs`, but the corepack bundled with Node 24.11 (0.34.2)
still looks for `bin/pnpm.cjs` and crashes. `packageManager` pins `pnpm@10.34.7`, which corepack runs fine.
Revisit when Node ships a newer corepack.

## D2. TypeScript 6, not 7 (2026-10-22)
TypeScript 7 is the native (Go) compiler and has no JavaScript API. Next.js build-time type checking and
typescript-eslint (inside eslint-config-next) both load that API, so they break on 7. We use 6.0.x until
those tools support 7.

## D3. Seed script runs on Node's built-in TypeScript support (2026-10-22)
`pnpm seed` is `node scripts/seed.ts`. Node 24 strips types natively, so we avoid adding tsx/ts-node.
The cost: files the script imports use explicit `.ts` extensions, and `erasableSyntaxOnly` +
`verbatimModuleSyntax` in tsconfig forbid syntax Node cannot strip (enums, non-`type` type imports).

## D4. Visit dates are calendar dates, not timestamps (2026-10-22)
`Visit.date` is `yyyy-MM-dd` in Asia/Seoul. Eligibility is counted in days, and a timestamp would
make the boundary day depend on the server's timezone. Request times keep a full ISO string with `+09:00`.

## D5. Own seeded PRNG instead of a faker library (2026-10-22)
A 10-line mulberry32 function gives reproducible data. A faker library would add a dependency and
risk producing realistic-looking names, phone numbers or addresses, which hard rule 1 forbids.

## D6. Eligibility takes a confirmed KCD code, not free text (2026-10-22)
`checkEligibility` compares `symptomKcdCode` with the visit's `kcdCode`. Turning the patient's free text
into a code is the symptom matcher's job (M3/M4) plus a clinician's confirmation. Keeping that out of the
rule function keeps it deterministic and testable (rules must be code, not AI): same input, same answer, no AI call.

## D7. Eligibility returns a reason code, not just true/false (2026-10-22)
"Not eligible" has four different fixes for staff: book an in-person visit (`NO_VISIT`,
`ONLY_TELEHEALTH_VISITS`), check the symptom (`NO_MATCHING_SYMPTOM`), or note the visit was too long ago
(`OUTSIDE_WINDOW`). The result also carries the rule version and evidence visit id for the audit log.
The order of checks decides which reason wins when several apply; tests pin that order.

## D8. Eligibility has three outcomes: follow_up, first_visit, not_allowed (2026-10-22)
Replaces the yes/no result of D7. Under the 2026-10-19 draft, failing the follow-up check means the request
is first-visit (초진) telehealth, which is allowed in the patient's own 시·도 or for listed exception groups.
Only a first-visit request from another region without an exception is `not_allowed`. The result keeps the
"why not follow-up" reason from D7, so staff still know whether booking an in-person visit would help.

## D9. Rule periods are { amount, unit } and end dates follow the Civil Act (2026-10-22)
"6 months" is not 180 days: it depends on month lengths. `periodEnd()` adds calendar months with date-fns and
applies the 민법 counting rule (start day not counted, end on the day before the matching day). This is an
assumption (A3) with tests for month ends and leap years, so changing the reading later is a one-function edit.

## D10. Old rule versions stay in config/rules (2026-10-22)
`rules.v1.json` (30-day placeholder) is kept next to `rules.v2.json` (draft). `getRules()` returns the newest.
Keeping both shows how rules evolve and gives the M5 impact preview a real pair to compare:
on the demo data, moving from v1 to v2 turns 2 follow-up requests into 11.

## D11. The prescription check screen is a GET form (2026-10-22)
`/prescriptions` submits with `method="get"`, so the URL holds every input and the server computes the result.
It works without JavaScript, a result can be bookmarked or shared in a bug report, and there is no client state
to keep in sync. The cost: inputs are visible in the URL, which is acceptable only because all data is synthetic.

## D12. Rule versions are never edited in place (2026-10-22)
Saving on the admin screen creates a new version (v3, v4, ...) instead of changing the current one. Every
eligibility and prescription result records its `ruleVersion`, so an old decision can always be explained with
the exact rules that produced it. Admin-saved versions live in memory for the demo and vanish on restart.

## D13. Domain returns codes; Korean sentences live in one labels file (2026-10-22)
`checkEligibility` and `checkPrescription` return codes like `EXTENSION_ALREADY_USED`, never sentences.
`src/components/labels.ts` turns codes into UI text. Tests stay stable when wording changes, the same reason
always reads the same way on every screen, and the domain stays free of UI concerns.

## D14. The matcher compares with each recent in-person visit, then suggests the best (2026-10-22)
A patient may have visits for several conditions. Comparing today's text only with the latest visit would miss
"sore throat again" when the latest visit was for back pain. We compare with the latest in-person visit per KCD
code (up to five) and suggest the one most likely to be "same". With an AI matcher this costs up to five calls
per request, which is why the result is computed once and cached (D15).

## D15. A suggestion is computed once per request and kept (2026-10-22)
The review page and the approve action must refer to the same suggestion, or the audit log could record numbers
the clinician never saw. `getSuggestion` caches the promise per request id. A failed call is removed from the
cache so the next page view retries instead of showing a stale error.

## D16. Rule-based suggestions are labeled differently from AI ones (2026-10-22)
Every automatic suggestion shows probabilities and "최종 판단은 의사". Only model output is labeled "AI 제안";
the keyword matcher says "자동 제안(규칙 기반)". Its probabilities are fixed confidence levels per rule, not
learned, and M4's calibration table measures how well they match reality.

## D17. An approved review is final (2026-10-22)
`applyReviewAction` refuses any change after approval. Eligibility is computed from the approved code and stored
with it; allowing edits would silently change the basis of a decision already acted on. A held review can still be
approved. Correcting an approved decision would need a new, separately audited action (not built).
