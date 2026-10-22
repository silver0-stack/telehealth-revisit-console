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
| `pnpm seed` | Regenerate `src/data/seed.json` (fixed seed, same output every time) |

## Screens

| Path | What it does |
|------|--------------|
| `/` | Synthetic patient list |
| `/prescriptions` | Checks whether a request is follow-up (일반) or first-visit (초진) telehealth, and whether a drug and day count are allowed |
| `/admin/rules` | Edits the telehealth prescription blocklist and day limits; every save becomes a new rule version |

## Demo limitations

- **In-memory storage.** Data lives in the server process and resets on every restart.
  The app reads records through the `RecordSource` interface, so a real store can replace it later.
- **Placeholder rules.** Eligibility windows and drug lists are assumptions, not the law.
- **No authentication.** There is a single implied clinician user, and anyone who can reach the server can
  save a rule version from `/admin/rules`.
- **Admin-saved rule versions are in memory** and disappear on restart. Shipped versions are in `config/rules/`.
- **Demo drug catalog.** Drug categories are demo assignments, not the official 식약처/MOHW lists.

## Status

- [x] M0 Scaffold
- [x] M1 Eligibility engine (follow-up / first-visit, based on the 2026-10-19 draft)
- [x] M2 Restricted drugs (blocklist, first-visit day limits, versioned admin screen)
- [ ] M3 Review flow
- [ ] M4 Jev + evaluation
- [ ] M5 Rule-change impact preview
- [ ] M6 E2E, accessibility, write-up
