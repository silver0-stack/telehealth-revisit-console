# Assumptions

Korea's revised Medical Act on telehealth takes effect 2026-12-24, but the detailed criteria are still being
set by decree and Ministry of Health and Welfare notices. Every number below is a **placeholder**.
Each one is tagged `ASSUMPTION` in code and must be checked before any real use.

| ID | Assumption | Where in code | What to verify | Where to verify |
|----|------------|---------------|----------------|-----------------|
| A1 | Follow-up (일반) window is **6 months** in the current rules (`rules.v2.json`, from the 2026-10-19 draft). `rules.v1.json` keeps the old 30-day placeholder for comparison | `config/rules/rules.v*.json` | Whether the final text keeps 6 months | 의료법 시행규칙 final text (after the 2026-11-09 comment period) |
| A2 | Only an `in_person` visit for the same symptom at the same clinic counts | `src/domain/eligibility.ts` | Supported by the draft (제31조의5⑤1). Re-check in the final text | Same as A1 |
| A3 | The window's last day is counted like the Civil Act: start day not counted, ends the day before the matching day; a missing day means the month's last day (e.g. 04-30 → 10-31, 08-31 → 02-28). The last day is included | `src/domain/dates.ts` (`periodEnd`) | Whether MOHW applies 민법 제157조·제160조 to this period, or counts "same day number 6 months later" | MOHW guidance / Q&A after the rule is final |
| A4 | Days are Asia/Seoul calendar days; the request's date is its Seoul date | `src/domain/dates.ts` | Whether the law uses calendar days and which clock decides the request date | Same as A1 |
| A5 | "Same clinic" is implied because the app models one clinic; other clinics' visits are never stored | `src/domain/eligibility.ts` | Supported by the draft ("해당 의료기관") | Same as A1 |
| A6 | The window starts at the **latest same-symptom** in-person visit (see the source check below for the competing reading) | `src/domain/eligibility.ts` | Which reading of 제31조의2① + 제31조의5⑤1 MOHW intends | MOHW guidance |
| A7 | "동일한 증상" is decided by a clinician (helped by the matcher); eligibility receives a confirmed KCD code | `src/domain/eligibility.ts` | Whether MOHW defines "same symptom" (code level, body system, or clinical judgment) | MOHW guidance |
| A8 | The once-only 30-day first-visit prescription (제31조의3④) counts once **per patient**, across all clinics and conditions | `src/domain/prescription.ts`, `rules.v2.json` (`extendedTimesPerPatient`) | Whether "1회" is per patient, per condition, or per period | Final text / MOHW 고시 on 진료이력·처방이력 확인 |
| A9 | The demo clinic is 의원급, so the 병원급 limits (제31조의4) do not apply | `src/data/clinic.ts` | n/a for a demo; real use must check the facility type | — |
| A10 | Which category each demo drug belongs to (e.g. 펜터민 → 마약·향정, 이소트레티노인 → 오·남용 우려) is a demo assignment | `src/data/drugs.ts` | The official lists: 마약류 품목허가, 식약처 오·남용 우려 의약품 고시, and the not-yet-published MOHW notice on 비만치료제 성분 (제31조의10②) | 식약처 고시; MOHW 고시 |
| A11 | The narrow exceptions that allow 마약류 by telehealth (제31조의10③: 희귀질환자, 호스피스 통증관리, 중단 시 중대한 위해) are not modeled; those orders are blocked and handled outside the tool | `src/domain/prescription.ts` | Whether a real tool must support the exception flow and what proof it needs | Final text / MOHW 고시 |
| A12 | Day limits apply only to first-visit telehealth; follow-up telehealth has no day limit in the draft | `src/domain/prescription.ts` | That the final text keeps 제31조의3 limited to 제34조의2제2항제2호 (초진) | Final text |
| A13 | `minConfidence = 0.8` is a starting point for when a suggestion may be pre-selected | `config/ai.json` | Tune from the M4 evaluation (calibration and error cost), not from regulation | `eval/results/` |
| A14 | The rule-based matcher's probabilities (0.9 / 0.7 / ...) are hand-set confidence levels | `src/ai/rule-based-matcher.ts` | Whether they are calibrated: M4 calibration table | `eval/results/` |
| A15 | The evaluation labels in `eval/cases.jsonl` are correct | `eval/cases.jsonl` | Have a clinician review the labels, especially the judgment calls listed in `eval/README.md` | Clinician review |

Rows are added as new assumptions appear.

## Source check: 2026-10-22 (primary source)

**Source:** 의료법 시행규칙 일부개정령안, 보건복지부공고 제2026-780호, 입법예고 2026-10-19 ~ 2026-11-09.
Notice page: https://opinion.lawmaking.go.kr/gcom/ogLmPp/89052 (attached draft text, read in full for the articles below).
Parent law: 의료법 법률 제21238호 (공포 2025-12-23, 시행 2026-12-24).
**This is a draft.** The text can change after the comment period. Re-check after 2026-11-09 and again before 2026-12-24.

What the draft says (article numbers are from the draft):

- **제31조의2①, 일반 (follow-up) telehealth window:** "환자가 해당 의료기관에서 마지막으로 대면하여 진료를 받은 날부터
  6개월이 되는 날까지의 기간".
- **제31조의5⑤1, how to check it:** look in this clinic's records for an in-person visit **for the same symptom**
  (동일한 증상으로 대면하여 진료받은 기록) within that window. Telehealth visits do not count; the text says 대면.
- **제31조의2②, 초진 (first-visit) telehealth:** allowed when the patient's registered address (or a 실거주지 registered in
  the 비대면진료지원시스템) is in the same 시·도 as the clinic.
- **제31조의2③, exceptions allowed outside the 시·도:** 14 categories, including 희귀질환자, 제1형 당뇨병 환자, 등록장애인,
  장기요양 수급자, 수용자, 호스피스대상환자, isolated 1st/2nd-class infectious disease patients, 선원, 군인, 경찰·소방공무원,
  국가보훈 희생·공헌자, 재외국민 abroad, plus others set by notice (고시).
- **제31조의3, 초진 prescriptions:** at most 7 days; up to 30 days if prior care and prescription history for the condition is
  confirmed and the clinician judges continuing treatment necessary, but **only once**, counting other clinics too.
- **제31조의10, never prescribable by telehealth:** 마약·향정신성의약품; drugs MFDS lists as high misuse risk; **비만치료제**;
  others set by MOHW notice. Narrow exception for 마약류 with the same ingredient previously prescribed in person
  (희귀질환자, 호스피스 pain control, stopping would seriously harm the patient, others by notice).
- **제31조의7, volume caps:** telehealth ≤ 30/100 of a clinic's visits per half-year; per clinician, monthly average per
  half-year ≤ 500 (doctors) or ≤ 130 (dentists, Korean medicine doctors). Visits after 20:00 on weekdays, after 18:00 on
  Saturdays, and on holidays are excluded from the count.
- **제31조의5①, method:** video by default; voice is allowed for 일반 telehealth if the clinician judges it enough, unless the
  condition needs visual information (제31조의11: under-13 patients, skin, eye, ENT, injuries).

How this affects the assumptions above:

| ID | Status after reading the draft |
|----|--------------------------------|
| A1 | **Differs.** The draft window is 6 months, counted in calendar months from the last in-person visit, not 30 days. **Applied in `rules.v2.json`.** |
| A2 | **Supported by the draft.** Only an in-person (대면) visit for the same symptom at the same clinic counts. |
| A3 | **Partly answered.** "6개월이 되는 날까지" includes the end date. Exact day arithmetic (e.g. a visit on 08-31) is not spelled out; it likely follows 민법 기간 계산 (제157조, 제160조). Verify. |
| A4 | Still open. The draft speaks in dates (날), which fits calendar days, but does not say which timezone or clock. |
| A5 | **Supported.** "해당 의료기관" = the same clinic. |
| A6 (new) | **Open question in the draft text:** 제31조의2① anchors the window on the *last* in-person visit (any symptom), while 제31조의5⑤1 asks for a same-symptom in-person visit *within* that window. The app reads it as "a same-symptom in-person visit within 6 months". Verify which reading MOHW intends. |
| A7 (new) | "동일한 증상" has no definition in the draft. Deciding it stays with the clinician; the app only suggests. |
| new | Failing the follow-up check does **not** mean "refuse". It means the request is 초진 telehealth, which has its own conditions (same 시·도 or an exception, 7-day prescriptions). **Applied:** `checkEligibility` now returns `follow_up`, `first_visit` or `not_allowed`. |

News reports used before finding the primary source (they match the draft text):
- 청년의사: http://www.docdocdoc.co.kr/news/articleView.html?idxno=3043716
- 경향신문: https://www.khan.co.kr/article/202610181200021/
- 보건복지부 보도자료 (2026-10-18): https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=1492252
