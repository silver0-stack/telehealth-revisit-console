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
