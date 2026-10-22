# 재진 확인 콘솔 (Telehealth Clinic Console)

A portfolio demo of a web console for small clinics that offer 비대면 (non-face-to-face) care:
check telehealth eligibility, block restricted prescriptions, review AI-suggested symptom matches,
and keep an audit trail of every decision.

> **All data is synthetic.** No real patient data is used anywhere. This is not medical advice and
> the legal thresholds are placeholders (see [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md)).

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
| `pnpm test` | Vitest unit tests |
| `pnpm eval:symptom` | Evaluate the symptom matcher on 102 synthetic cases (see [eval/README.md](eval/README.md)) |
| `pnpm seed` | Regenerate `src/data/seed.json` (fixed seed, same output every time) |

## Screens

| Path | What it does |
|------|--------------|
| `/` | Synthetic patient list |
| `/reviews` | Telehealth requests. Each one compares the patient's words with earlier in-person visits and suggests a match; the clinician chooses 승인 / 수정하고 승인 / 보류 |
| `/audit` | Append-only log of every human decision, with the suggestion, probabilities and matcher version shown at the time |
| `/prescriptions` | Checks whether a request is follow-up (일반) or first-visit (초진) telehealth, and whether a drug and day count are allowed |
| `/admin/rules` | Edits the telehealth prescription blocklist and day limits; every save becomes a new rule version |

## Demo limitations

- **In-memory storage.** Data lives in the server process and resets on every restart.
  The app reads records through the `RecordSource` interface, so a real store can replace it later.
- **Placeholder rules.** Eligibility windows and drug lists are assumptions, not the law.
- **No authentication.** There is a single implied clinician user, and anyone who can reach the server can
  save a rule version from `/admin/rules`.
- **Admin-saved rule versions, review decisions and the audit log are in memory** and disappear on restart. Shipped versions are in `config/rules/`.
- **Jev needs paid AI Gateway credits.** The free tier returns 403 for `typesafe-ai/jev`. Without credits,
  run with `MATCHER=rules`; everything works, with the weaker rule-based suggestions.
- **No zero data retention.** Not available on Hobby. Fine for synthetic text only; real patient text would
  need a plan with ZDR and much more than this demo provides.
- **Demo drug catalog.** Drug categories are demo assignments, not the official 식약처/MOHW lists.

## Status

- [x] M0 Scaffold
- [x] M1 Eligibility engine (follow-up / first-visit, based on the 2026-10-19 draft)
- [x] M2 Restricted drugs (blocklist, first-visit day limits, versioned admin screen)
- [x] M3 Review flow (rule-based matcher, clinician review, audit log)
- [x] M4 Jev + evaluation (Jev: 0 wrong pre-selections vs 7 for the rule-based baseline, see [eval/README.md](eval/README.md))
- [ ] M5 Rule-change impact preview
- [ ] M6 E2E, accessibility, write-up
