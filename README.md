# 재진 확인 콘솔 (Telehealth Clinic Console)

A portfolio demo of a web console for small clinics that offer 비대면 (non-face-to-face) care:
decide whether a telehealth request is a follow-up (일반) or first-visit (초진) visit, block restricted
prescriptions, review AI-suggested symptom matches, preview the impact of rule changes, and keep an audit trail
of every decision.

> **All data is synthetic.** No real patient data is used anywhere. This is not medical advice: the tool
> organizes information and every decision belongs to a clinician. Legal thresholds follow a **draft** rule
> and are listed as assumptions in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Why this project

Korea's revised Medical Act makes telehealth permanent from **2026-12-24**. On 2026-10-19 the Ministry of Health
and Welfare published the draft enforcement rule (보건복지부공고 제2026-780호). This project reads that draft
(article numbers are cited in the code and docs) and turns it into tested code:

- **Follow-up vs first visit** (제31조의2, 제31조의5): an in-person visit at the same clinic for the same symptom
  within 6 months makes a request a follow-up; otherwise it is a first visit, allowed only in the patient's own
  시·도 or for 14 exception groups.
- **Prescription limits** (제31조의3, 제31조의10): narcotics, high-misuse drugs and obesity treatments are blocked;
  first-visit prescriptions are limited to 7 days, or 30 days once per patient with confirmed history.
- Where the draft is unclear (how to count "6 months", what "same symptom" means), the code makes an explicit,
  tested choice and records it as an assumption to verify.

## Design in one paragraph

**Rules are code, AI only suggests.** Eligibility, prescription checks and the rule-change diff are pure
TypeScript functions in `src/domain/` with unit tests. Rule values live in versioned files (`config/rules/`),
never in components; every result records the rule version it used. The only AI task is comparing the
patient's own words ("목이 따가워요") with an earlier visit note ("인후통"). A suggestion is pre-selected only when
the model is at least 80% sure, the clinician always approves or edits it, and the audit log records the
probabilities and model version the clinician saw. The app works fully without AI (`MATCHER=rules`).

## Where the AI was wrong, and how that was handled

Measured on 102 synthetic cases with tags for synonyms, typos, look-alikes and vague complaints
([eval/README.md](eval/README.md)):

| | Rule-based keywords | Jev (`typesafe-ai/jev-1.14.0`) |
|---|---|---|
| Accuracy | 77.5% | 84.3% |
| **Wrong pre-selections** (a different condition shown as "same") | **7** | **0** |
| "90–100% sure" answers that were right | 85% | 97% |

- The keyword baseline confidently matched "머리카락이 많이 빠져요" to migraine (it contains "머리") and
  "목이 아파서 고개를 못 돌리겠어요" (neck) to a sore throat. Jev did not call any of those 7 "same".
- Jev still called three non-matching complaints "same", but each at 49–63% confidence. The 0.8 threshold,
  chosen from the calibration table rather than guessed, kept all three from being pre-selected.
- Both matchers fail when two complaints are mixed in one sentence ("목도 따갑고 허리도 아파요").
  The review screen shows the probabilities, so the clinician sees the uncertainty.
- The evaluation labels were written by the author, not a clinician (assumption A15), so these numbers compare
  two matchers on the same set; they are not clinical accuracy.

## Run it

Requires Node 24+. pnpm comes through corepack (see [D1](docs/DECISIONS.md)).

```bash
pnpm install
cp .env.example .env.local   # defaults work as-is: MATCHER=rules needs no key
pnpm dev                     # http://localhost:3000
```

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Local dev server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests (domain rules, matchers, metrics) |
| `pnpm test:e2e` | Playwright: the clinician flow end to end, plus axe WCAG 2.1 A/AA checks on every screen at desktop and phone size. Starts its own server on port 3100 with `MATCHER=rules`. First run: `pnpm exec playwright install chromium` |
| `pnpm eval:symptom` | Evaluate the symptom matcher on 102 synthetic cases (`--matcher rules` or `--matcher jev`) |
| `pnpm seed` | Regenerate `src/data/seed.json` (fixed seed, same output every time) |

## Screens

| Path | What it does |
|------|--------------|
| `/` | Synthetic patient list |
| `/reviews` | Telehealth requests. Each one compares the patient's words with earlier in-person visits and suggests a match; the clinician chooses 승인 / 수정하고 승인 / 보류 |
| `/audit` | Append-only log of every human decision, with the suggestion, probabilities and matcher version shown at the time |
| `/prescriptions` | Checks whether a request is follow-up (일반) or first-visit (초진) telehealth, and whether a drug and day count pass the rules |
| `/admin/rules` | Edits the telehealth prescription blocklist and day limits. Shows who is affected first; only then can it be saved as a new rule version |
| `/admin/rules/impact` | Compares any two rule versions (e.g. v1 → v2: 30 days → 6 months turns 27 first-visit scenarios into follow-ups) |

Accessibility: base font 16px with a "큰 글씨" toggle, visible keyboard focus, a skip link, status shown with
icon and text (never color alone), `prefers-reduced-motion` respected, layouts down to phone width.

## Project map

```
src/domain/   pure rules: eligibility, prescription, rule-diff, review state, dates. No React or Next.
src/ai/       SymptomMatcher interface, RuleBasedMatcher, JevMatcher (the only code that calls AI Gateway)
src/data/     RecordSource + in-memory mock, rules store, audit log, review store
src/app/      routes;  src/components/  UI and all Korean wording (labels.ts)
config/       rules.v1.json (old 30-day placeholder), rules.v2.json (2026-10-19 draft), ai.json
eval/         cases, metrics, results;  e2e/  Playwright specs;  docs/  DECISIONS.md, ASSUMPTIONS.md
```

## Demo limitations

- **In-memory storage.** Review decisions, admin-saved rule versions and the audit log live in the server
  process and disappear on restart. Records are read through the `RecordSource` interface, so a real store
  can replace the mock. A real audit log needs append-only, tamper-evident storage.
- **Draft rules.** Thresholds follow a draft that may change after its comment period (ends 2026-11-09).
- **No authentication.** One implied clinician and admin; anyone who can reach the server can save a rule
  version. Server actions mark where authorization checks belong.
- **Demo drug catalog.** Drug categories are demo assignments, not the official 식약처/MOHW lists.
- **Other clinics' records are not visible.** The real check uses the government 비대면진료지원시스템.
- **Jev needs paid AI Gateway credits.** The free tier returns 403 for `typesafe-ai/jev`. Without credits,
  run with `MATCHER=rules`.
- **No zero data retention.** Not available on the Hobby plan. Acceptable only because every request is
  synthetic; real patient text would need ZDR and a legal review before any of it left the clinic.

## Status

- [x] M0 Scaffold
- [x] M1 Eligibility engine (follow-up / first-visit, based on the 2026-10-19 draft)
- [x] M2 Restricted drugs (blocklist, first-visit day limits, versioned admin screen)
- [x] M3 Review flow (rule-based matcher, clinician review, audit log)
- [x] M4 Jev + evaluation (Jev: 0 wrong pre-selections vs 7 for the rule-based baseline)
- [x] M5 Rule-change impact preview (`diffRules`, preview before save, version comparison)
- [x] M6 E2E (8 flow tests), axe checks on 8 screens × 2 viewports, this write-up
- [ ] M7 (optional) FHIR-backed `RecordSource` with Synthea data
