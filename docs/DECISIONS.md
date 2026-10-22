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

## D18. The evaluation's headline number is wrong pre-selections, not accuracy (2026-10-22)
The app only acts on a confident "same": it pre-selects that code. A wrong "same" can turn a first visit into a
follow-up, which changes what may be prescribed. Mixing up "related" and "different" changes nothing in the app.
So the script reports pre-selection precision and lists every wrong pre-selection by case id, before accuracy.

## D19. Jev is called with a pinned version (2026-10-22)
`config/ai.json` names `typesafe-ai/jev-1.14.0` instead of the moving alias `typesafe-ai/jev`. Results in
`eval/results/` stay comparable over time, and the audit log records the version that actually answered
(`result.response.modelId`). Moving to a new version means re-running the evaluation first.

## D20. Jev needs paid credits (2026-10-22, updated the same day)
A single test call returned `403 Free tier users do not have access to this model`. The Vercel account is on
Hobby with only free AI Gateway credits, and the minimum paid top-up is $10. `JevMatcher` was written against
the documented API and unit-tested with a fake `decide` before any real call. The
rule-based baseline was evaluated so the comparison is ready once credits exist. Zero data retention is also
unavailable on Hobby (Pro and Enterprise only); acceptable here only because every request is synthetic text.

## D21. Keep minConfidence at 0.8, now based on data (2026-10-22)
On the 102-case evaluation, Jev's answers at 0.8 and above were right 97% of the time and produced no wrong
pre-selection; its three wrong "same" answers all scored 0.49–0.63. Answers at 0.7–0.8 were right 82% of the time.
0.8 stays, and A13 now has evidence behind it. Re-run the evaluation before changing the model version or threshold.

## D22. Impact is measured on "what if they asked today?" scenarios (2026-10-22)
The demo has only 26 real requests, too few to show a rule change. `diffRules` instead asks, for every patient:
"if you requested telehealth today for each condition you were seen for in person, or for a new symptom, what
would each rule version say?" and "if your latest prescription per drug were repeated by telehealth?". It is a
pure function of the rules and the records, so the same comparison always gives the same list. The scenarios
are written on the screen next to the numbers so nobody mistakes them for real requests.

## D23. A new rule version can only be saved from its preview (2026-10-22)
The edit form only offers "영향 미리보기" (GET). Saving is a second button on the preview, carrying the same
values as hidden fields plus the version the preview was based on. If another version was saved in between,
the save is refused (`STALE_PREVIEW`) because the impact shown is no longer true. The audit entry for the save
includes the impact counts.
