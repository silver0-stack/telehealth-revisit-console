# Symptom-match evaluation

Measures how well a `SymptomMatcher` answers one question: is today's complaint the **same** as,
**related** to, or **different** from the note of an earlier in-person visit?

```bash
pnpm eval:symptom                   # matcher from MATCHER in .env.local (default: rules)
pnpm eval:symptom --matcher rules
pnpm eval:symptom --matcher jev     # needs AI_GATEWAY_API_KEY and paid AI Gateway credits
pnpm eval:symptom --limit 5         # quick check, results not saved
```

Results are saved to `results/<date>-<matcher>.json` with every prediction, so runs can be compared later.

## Cases (`cases.jsonl`)

102 synthetic pairs over the 9 demo conditions. Every text is invented; none comes from a real patient.

| Tag | What it tests |
|-----|---------------|
| `same_wording` | Patient repeats the clinical word ("인후통") |
| `synonym` | Everyday words for the same condition ("목이 따가워요" for 인후통) |
| `colloquial` | Loose speech, run-on sentences ("감기걸린거 같아요 콧물나요") |
| `typo` | Misspellings ("기칭", "두퉁", "받고시퍼요") |
| `lookalike` | Shares a word but is a different condition ("목이 아파서 고개를 못 돌려요" is the neck, not the throat) |
| `related` | Same body system or a likely complication |
| `different` | Unrelated condition |
| `mixed` | Two complaints in one sentence |
| `vague` | Too unclear to call "same" |
| `short` | One word |

### How labels were decided

- **same**: the same condition as the earlier visit, however it is worded.
- **related**: a different condition in the same body system, or a likely complication
  (e.g. foot numbness for a diabetic patient).
- **different**: unrelated, or too vague to call the same. A vague complaint is labeled "different"
  because the app must not treat it as a follow-up.

**Limitation:** labels were written by the project author with AI assistance, not reviewed by a clinician.
Several cases are judgment calls (for example C-044, C-067, C-099). Treat the numbers as a comparison between
matchers on the same set, not as clinical accuracy.

## Metrics

- **Accuracy**, overall and per tag.
- **Pre-selection**: the app pre-selects a suggestion only when the matcher says "same" with
  probability ≥ `minConfidence` (`config/ai.json`). The key safety number is **wrong pre-selections**:
  a different condition shown as "same" could make a first visit look like a follow-up.
- **Calibration**: answers grouped by confidence. If "90% sure" is right only 70% of the time, the
  probabilities should not be trusted as-is and the threshold must be set from data.
- **Confusions**: the most common truth → predicted mistakes, with example cases.

Do not add synonyms just to fix individual cases in this file: the set would stop measuring anything.
New cases for tuning belong in a separate file.

## Results: 2026-10-22

Same 102 cases, `minConfidence` 0.8. Full predictions: `results/2026-10-22-rules.json`, `results/2026-10-22-jev.json`.

| | Rule-based (`synonyms-v1`) | Jev (`typesafe-ai/jev-1.14.0`) |
|---|---|---|
| Accuracy (3 labels) | 77.5% | **84.3%** |
| Pre-selected | 47 | 42 |
| **Wrong pre-selections** | **7** | **0** |
| Pre-selection precision | 85.1% | **100%** |
| Truly "same" left for the clinician | 11 | 9 |
| Typos | 66.7% | **100%** |
| Vague | 0% | **100%** |
| Lookalikes | 60.9% | 56.5% |
| Related | 100% | 75.0% |
| "90–100% sure" was right | 85.1% | 96.7% |
| Latency p50 / p95 | ~0 ms | 503 / 1088 ms |

What this says:

- **Where the rules were wrong and Jev fixed it.** All 7 cases the rule-based matcher wrongly pre-selected
  were *not* called "same" by Jev. Five it got fully right (e.g. C-101 "머리카락이 많이 빠져요" is not a
  headache; C-098 "머리를 부딪혀서" is an injury; C-064 leg numbness is related to, not the same as, back pain).
  Two it called "related" instead of "different" (C-007 neck pain, C-067 back pain with painful urination),
  which is a harmless mistake for this app.
- **Where Jev is still wrong.** It called three non-"same" cases "same" (C-018, C-020, C-081), but each with
  49–63% probability, so the 0.8 threshold kept them from being pre-selected. Its weakest tag is still
  `lookalike`: it mixes up "related" and "different" (5 each way), which does not change any app decision.
- **Calibration.** Jev's high-confidence answers are trustworthy (61 answers at 90–100%, 96.7% correct;
  12 at 80–90%, all correct). Below 0.7 it is close to a coin flip. That supports keeping
  `minConfidence` at 0.8: lowering it to 0.7 would add answers that are right only ~82% of the time.
- **Both fail on `mixed`** (two complaints in one sentence), e.g. C-010 "목도 따갑고 허리도 아파요".
  The review screen shows the probabilities, so the clinician sees the uncertainty.

Cost: each case is one small request; the whole run cost well under one cent (estimated from the model's
per-token price, not read from the bill).
