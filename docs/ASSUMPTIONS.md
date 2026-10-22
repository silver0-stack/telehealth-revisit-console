# Assumptions

Korea's revised Medical Act on telehealth takes effect 2026-12-24, but the detailed criteria are still being
set by decree and Ministry of Health and Welfare notices. Every number below is a **placeholder**.
Each one is tagged `ASSUMPTION` in code and must be checked before any real use.

| ID | Assumption | Where in code | What to verify | Where to verify |
|----|------------|---------------|----------------|-----------------|
| A1 | Re-visit window is 30 days (`revisitWindowDays: 30`) | `config/rules/rules.v1.json` | The actual window, and whether it differs by condition or patient group | Enforcement Decree of the Medical Act; MOHW notices on 비대면 진료 |
| A2 | Only an `in_person` visit for the same symptom at the same clinic counts | `src/domain/eligibility.ts` | Whether a prior telehealth visit or another clinic's visit can count | Same as A1 |
| A3 | The boundary day counts: a visit exactly `revisitWindowDays` days before the request is still inside the window | `src/domain/eligibility.ts` | Whether the window is inclusive, and whether it counts from the visit day or the next day | Same as A1 |
| A4 | Days are counted as Asia/Seoul calendar days between the visit date and the request date | `src/domain/eligibility.ts`, `src/domain/dates.ts` | Whether the law counts calendar days, 24-hour periods, or business days | Same as A1 |
| A5 | "Same clinic" is implied because the app models one clinic; other clinics' visits are never stored | `src/domain/eligibility.ts` | Whether a visit at a related clinic (same group or referral) can count | Same as A1 |

Rows are added as new assumptions appear (restricted drug list in M2, AI confidence threshold in M4).

## Source check: 2026-10-22

On 2026-10-19 the Ministry of Health and Welfare published a **draft** (입법예고, comment period until 2026-11-09)
of amendments to the 의료법 시행규칙 and 의료관계 행정처분 규칙. It is a draft, not final; re-check after 2026-11-09.
Summary of what news reports say it contains:

- **일반 (follow-up) telehealth:** the patient had an in-person visit **at the same clinic, for the same symptom,
  within the last 6 months.**
- **초진 (first-visit) telehealth** applies otherwise (different symptom, or more than 6 months since the last
  in-person visit). It is **allowed**, at a 의원급 clinic in the same 시·도 as the patient's registered address.
  Exceptions that may use another 시·도: 희귀질환자, 제1형 당뇨병 환자, 등록장애인, 장기요양수급자.
- **Prescriptions after 초진 telehealth:** 7 days at most; once, up to 30 days if there is a prior history for the
  condition and the doctor judges continued treatment necessary.
- **Not prescribable via telehealth (in principle):** 마약·향정신성의약품, 오·남용 우려 의약품, 비만치료제.
- **Volume caps:** a clinic's telehealth visits ≤ 30% of all visits per half-year; per clinician, a monthly average
  per half-year of ≤ 500 (doctors) or ≤ 130 (dentists, Korean medicine doctors).

How this affects the assumptions above:

| ID | Status after the draft |
|----|------------------------|
| A1 | **Differs.** Draft says 6 months, not 30 days. "6 months" is a calendar-month window, not a fixed day count. |
| A2 | **Matches the draft** for 일반 telehealth (in-person, same symptom, same clinic). Reports do not mention prior telehealth visits counting. |
| A3 | Not addressed in reports. Still unverified. |
| A4 | Not addressed in reports. Still unverified. |
| A5 | Matches ("해당 의료기관"). |
| new | Failing the follow-up check does **not** mean "refuse": it means the request is 초진 telehealth, which has its own conditions. The app's model of eligible / not eligible is incomplete. |

Sources (news reports, not the official text; read the 입법예고 itself on 국민참여입법센터 before relying on any number):
- 청년의사, "비대면진료 세부기준 윤곽…6개월 내 진료기관 원칙·비만약 제외": http://www.docdocdoc.co.kr/news/articleView.html?idxno=3043716
- 경향신문, "비대면진료 초진 처방 7일로 제한···진료도 거주지 시·도 내에서": https://www.khan.co.kr/article/202610181200021/
- 이투데이, "비대면진료 기준 구체화…초진 처방 7일 이내": https://www.etoday.co.kr/news/view/2636828
