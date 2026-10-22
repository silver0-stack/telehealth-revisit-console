# Telehealth Clinic Console (비대면 진료 관리 웹)

Portfolio project: a web console for small clinics that offer non-face-to-face (비대면) care.
Clinic staff and doctors check telehealth eligibility, get blocked from restricted prescriptions,
review AI-suggested symptom matches, and approve or edit them. Every decision leaves an audit trail.

The owner is a junior developer building this for a healthcare-IT job search.
Quality bar: every file must be something the owner can explain without AI help.

## Hard rules (read first)

1. **Synthetic data only.** Never use, request, or generate real patient data. Seed data is obviously fake
   (fixed fake Korean-style names, no real phone/RRN patterns, no real facility names).
   Every screen shows the banner: "모든 데이터는 가상입니다".
2. **Not medical advice.** The tool organizes information for a clinician. The UI never states a diagnosis
   or prescription as fact. The final decision belongs to a human clinician.
3. **Rules are code, not AI.** Re-visit eligibility and restricted-drug blocking are pure, deterministic
   TypeScript functions with unit tests. Never route them through an LLM.
4. **Jev only suggests**, and only for comparing free-text symptoms (see "AI: Jev").
   The app must work completely with `MATCHER=rules`.
5. **Every AI suggestion** is shown with its probabilities, can be approved or edited by a clinician,
   and is written to the audit log.
6. **Rules live in versioned config** (`config/rules/*.json`, validated with zod).
   Never put rule constants inside components.
7. **Secrets** stay in `.env.local`. Never print, log, or commit them. Keep `.env.example` current.
8. **Ask before:** adding a dependency outside the stack below, changing the data schema after M2,
   deleting files, rewriting git history, or calling any network service except Vercel AI Gateway.

## Context (as of Oct 2026)

- Korea's revised Medical Act on telehealth takes effect 2026-12-24. Detailed criteria are still being
  set through decrees and Ministry of Health and Welfare notices.
- Therefore: **never state a legal threshold as fact.** Use placeholders in config, tag them `ASSUMPTION`
  in code, and list each one in `docs/ASSUMPTIONS.md` with what to verify and where.
- Placeholder: `revisitWindowDays: 30` is an ASSUMPTION, not the real rule.

## Stack

- Next.js (App Router), TypeScript `strict`, Tailwind CSS
- zod (validation), date-fns (all dates are ISO strings, timezone Asia/Seoul)
- Vitest (unit tests), Playwright + axe (E2E and accessibility checks)
- AI: `ai` SDK v7 through Vercel AI Gateway
- Package manager: pnpm (if it is missing, ask)
- Persistence: start with an in-memory repository behind an interface. Add SQLite only if the owner asks.
  Document the demo limitation in the README.

## Commands

```bash
pnpm dev                  # local dev server
pnpm typecheck            # tsc --noEmit
pnpm lint
pnpm test                 # Vitest
pnpm test:e2e             # Playwright
pnpm seed                 # regenerate synthetic data (fixed seed, reproducible)
pnpm eval:symptom         # run the symptom-match evaluation (see M4)
```

Before saying a task is done, run `pnpm typecheck && pnpm lint && pnpm test`. Report real results.
Never write "should work" in place of running it.

## Structure

```
src/domain/      pure logic: eligibility, restrictions, rule diff. No React or Next imports.
src/ai/          SymptomMatcher interface, RuleBasedMatcher, JevMatcher. Only place that calls the AI Gateway.
src/data/        RecordSource interface + MockRecordSource (FHIR source is optional milestone M7)
src/app/         routes
src/components/  UI
config/rules/    versioned rule files (e.g. rules.v1.json)
eval/            labeled cases, eval script, results
docs/            DECISIONS.md, ASSUMPTIONS.md
```

## Domain

- `Patient`: synthetic id, display name, birth year.
- `Visit`: date, mode (`in_person` | `telehealth`), `kcdCode`, `note`.
- `TelehealthRequest`: patient, symptom text, requested at.
- `EligibilityResult`: eligible or not, reason code, the rule version used, evidence visit id.
- `PrescriptionOrder`: drug code, patient, result (`allowed` | `blocked`), reason.
- `AuditEvent`: actor, timestamp, action, before/after, AI suggestion, probabilities,
  model id and version, clinician decision.

Eligibility (placeholder logic, configurable): a request is eligible only if the same clinic has an
`in_person` visit for the same symptom within the configured window. `telehealth` visits never count.
Edge cases that must have tests: exact boundary day, no visit, only telehealth visits, several visits.

Signature feature: **rule-change impact preview.** `diffRules(oldRules, newRules, patients)` is a pure
function returning who loses or gains eligibility and which orders become blocked.
The UI shows counts and a list before the new rule version is applied.

## AI: Jev

- Jev is TypeSafe's decision model. It returns typed answers (choice, score, boolean) with probabilities,
  not text. Model id: `typesafe-ai/jev`. Needs `AI_GATEWAY_API_KEY`.
- It is new and experimental. **Before writing any Jev code, read
  https://vercel.com/docs/ai-gateway/modalities/decision and confirm the import name and response shape.**
  If the docs differ from this file, follow the docs and record the change in `docs/DECISIONS.md`.
  As of this writing: `import { experimental_decide as decide } from 'ai'` (needs `ai` >= 7.0.128;
  earlier 7.x uses `experimental_evaluate`), and a `choice` answer returns `choice` plus `probabilities`.
- Use exactly one question: is today's symptom the same as, related to, or different from the previous
  in-person visit note? Options: `same` | `related` | `different`.
- Wrap it in `SymptomMatcher` and keep `RuleBasedMatcher` (KCD code match plus a small synonym list,
  e.g. 인후통 ~ 목 따가움) as the baseline. Switch with `MATCHER=rules|jev`.
- If the top probability is below `config.ai.minConfidence` (default 0.8, tune it from eval results),
  show "의사 확인 필요" and do not pre-select a suggestion.
- Always record the model id/version and the probabilities in the audit log.
- Keep requests free of anything but synthetic text. Prefer zero data retention if the SDK supports it
  (verify in the docs; do not assume).

## Milestones (do in order, stop and report after each)

- **M0 Scaffold:** project, lint, test setup, seed script (about 40 patients), banner, `.env.example`.
- **M1 Eligibility engine:** `src/domain/eligibility.ts` + tests for every edge case above.
- **M2 Restricted drugs:** config-driven blocklist, order check, simple admin screen to edit and version it.
- **M3 Review flow:** `SymptomMatcher` + `RuleBasedMatcher`, clinician review screen (approve, edit and approve,
  hold), audit log view.
- **M4 Jev + evaluation:** `JevMatcher`, `eval/cases.jsonl` (about 100 labeled pairs including hard ones:
  synonyms, similar-looking different conditions, typos), `pnpm eval:symptom`.
  The script prints accuracy overall and by tag, a calibration table (does "90%" mean about 90% correct?),
  and the most common confusions. Save to `eval/results/<date>-<matcher>.json`.
- **M5 Impact preview:** `diffRules` + UI.
- **M6 Quality:** Playwright E2E for the core flow, axe checks, README (decisions, limits, where the AI was
  wrong and how it was fixed).
- **M7 (optional):** FHIR-backed `RecordSource` using Synthea-generated data.

At the start of each milestone, write a plan of at most 10 lines, then proceed.
At the end, give the owner a short Korean summary and **3 questions the owner should be able to answer
about the new code** (this is how the owner makes the code their own).

## UI rules

- UI copy is Korean, plain words, active voice. Buttons name the action: "승인", "수정하고 승인", "보류".
  Keep the same action name through the whole flow.
- AI output always carries the label "AI 제안 · 최종 판단은 의사" and a probability display.
- Status is never color-only: use icon plus text.
- Accessibility floor: WCAG AA contrast, visible keyboard focus, keyboard-operable tables, base font 16px
  or larger plus a "큰 글씨" toggle, respect `prefers-reduced-motion`, responsive down to mobile.
- Look: a calm, dense-but-readable clinical tool. Define color and type tokens in `src/styles/tokens.css`
  and use them everywhere. One accent color; status colors only for status.
  Avoid generic template looks (identical rounded cards with soft shadows, gradient washes, decorative motion).
- Empty and error states say what happened and what to do next. They do not apologize or stay vague.

## Code rules

- TypeScript `strict`. No `any`. Validate at boundaries with zod.
- `src/domain/` has no framework imports. Tests live next to the code as `*.test.ts`.
- Comments explain why, not what. Every rule assumption gets an `ASSUMPTION` comment.
- No silent `catch`. Surface errors to the UI or the audit log.
- Commit after each passing milestone with a conventional commit message. Never force-push.

## Do / Don't

- Don't hardcode rule constants in components. Read them through `getRules()`.
- Don't call Jev where a deterministic answer exists. Write a function and a test instead.
- Don't invent legal requirements. Add an `ASSUMPTION` and list it in `docs/ASSUMPTIONS.md`.
- Don't add a library for a one-off task. Ask, or write the small helper.
- Don't hide uncertainty. If something is unverified, say so in the summary.
- Don't work around a failing test by weakening it. Fix the cause or ask.

## Working with the owner

- Reply to the owner in Korean, briefly. Code, comments, and commit messages are in English.
- The owner may be tired or low on energy. Keep each step small and say exactly what to run next.
- Explain non-obvious design choices in `docs/DECISIONS.md` (3 to 5 lines each).
- If the owner corrects you twice on the same thing, propose a one-line addition to this file.
