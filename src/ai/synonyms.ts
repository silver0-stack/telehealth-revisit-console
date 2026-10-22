// Everyday words patients use, mapped to the KCD codes in the demo data. Spaces are removed before
// matching, so "목이 따가워요" and "목이따가워요" both hit "목이따가". Kept small on purpose:
// this is the baseline the AI matcher has to beat (M4), not a medical vocabulary.
export const SYNONYMS_VERSION = "synonyms-v1";

export const SYMPTOM_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "J02.9": ["인후통", "인두염", "목따가", "목이따가", "목따갑", "목이따갑", "목이아", "목아파", "목아프", "삼킬때", "연하통"],
  "J06.9": ["감기", "콧물", "기침", "미열", "상기도"],
  "J30.4": ["비염", "재채기", "코막", "코가막", "코간지", "코가간지"],
  I10: ["혈압", "고혈압"],
  "E11.9": ["혈당", "당뇨"],
  "M54.5": ["요통", "허리"],
  "K21.9": ["속쓰", "속이쓰", "역류", "가슴이타", "신물"],
  "L20.9": ["아토피", "가려", "간지러", "피부"],
  "G43.9": ["두통", "편두통", "머리", "지끈"],
};
