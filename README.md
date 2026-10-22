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

## Demo limitations

- **In-memory storage.** Data lives in the server process and resets on every restart.
  The app reads records through the `RecordSource` interface, so a real store can replace it later.
- **Placeholder rules.** Eligibility windows and drug lists are assumptions, not the law.
- **No authentication.** There is a single implied clinician user.

## Status

- [x] M0 Scaffold
- [x] M1 Eligibility engine (follow-up / first-visit, based on the 2026-10-19 draft)
- [ ] M2 Restricted drugs
- [ ] M3 Review flow
- [ ] M4 Jev + evaluation
- [ ] M5 Rule-change impact preview
- [ ] M6 E2E, accessibility, write-up
