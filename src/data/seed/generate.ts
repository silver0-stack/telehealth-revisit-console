import { format, parseISO, subDays } from "date-fns";
import { SIDO, type Dataset, type Patient, type Sido, type TelehealthRequest, type Visit } from "../../domain/types.ts";

// Small seeded PRNG (mulberry32) so `pnpm seed` gives the same data every run
// without adding a faker dependency.
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() called with an empty list");
  return item;
}

function intBetween(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Given names are food/plant words so nobody mistakes them for real people.
const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"] as const;
const GIVEN_NAMES = [
  "보리", "머루", "다래", "달래", "냉이", "호두", "자두", "앵두",
  "모과", "유자", "쑥갓", "도토리", "솔잎", "들깨", "녹두", "단풍",
] as const;

// A few of the draft's outside-region categories, enough to exercise the region check.
const EXCEPTION_SAMPLES = ["rare_disease", "type1_diabetes", "registered_disability", "long_term_care"] as const;

// KCD codes are a public classification, not patient data. `requestPhrases` mix
// clinical words and everyday wording on purpose: that gap is what the symptom
// matcher (M3/M4) has to bridge.
export const CONDITIONS = [
  { kcdCode: "J02.9", notes: ["인후통, 발열 없음", "인후통 및 연하통"], requestPhrases: ["목이 따가워요", "침 삼킬 때 목이 아파요", "인후통이 다시 생겼어요"] },
  { kcdCode: "J06.9", notes: ["콧물, 기침, 미열", "상기도 감염 증상"], requestPhrases: ["감기 기운이 있어요", "콧물이랑 기침이 나요"] },
  { kcdCode: "J30.4", notes: ["재채기, 맑은 콧물, 코막힘", "알레르기 비염 증상 지속"], requestPhrases: ["재채기가 계속 나요", "코가 막히고 간지러워요"] },
  { kcdCode: "I10", notes: ["혈압 관리, 기존 약 유지", "혈압 145/92, 생활습관 상담"], requestPhrases: ["혈압약 상담 받고 싶어요", "집에서 잰 혈압이 조금 높아요"] },
  { kcdCode: "E11.9", notes: ["혈당 관리, 식이 상담", "공복혈당 측정 결과 확인"], requestPhrases: ["혈당 수치 상담하고 싶어요", "당뇨약 먹고 있는데 질문이 있어요"] },
  { kcdCode: "M54.5", notes: ["요통, 방사통 없음", "허리 통증, 물리치료 권유"], requestPhrases: ["허리가 또 아파요", "오래 앉아 있으면 허리가 뻐근해요"] },
  { kcdCode: "K21.9", notes: ["속쓰림, 야간 악화", "위식도역류 증상"], requestPhrases: ["속이 쓰려요", "밥 먹고 나면 가슴이 타는 느낌이에요"] },
  { kcdCode: "L20.9", notes: ["팔 오금 가려움, 건조", "아토피 피부염 악화"], requestPhrases: ["피부가 가려워요", "팔 접히는 곳이 빨갛고 간지러워요"] },
  { kcdCode: "G43.9", notes: ["편측 두통, 빛 과민", "편두통 반복"], requestPhrases: ["머리 한쪽이 지끈거려요", "두통이 자주 와요"] },
] as const;

export type GenerateOptions = {
  seed: number;
  /** Anchor date for the fake timeline (Asia/Seoul calendar date). */
  today: string;
  patientCount: number;
  /** Most patients live in the clinic's region, like a real neighborhood clinic. */
  clinicRegion: Sido;
};

export function generateDataset({ seed, today, patientCount, clinicRegion }: GenerateOptions): Dataset {
  const random = createRandom(seed);
  const todayDate = parseISO(today);
  const patients: Patient[] = [];
  const visits: Visit[] = [];
  const requests: TelehealthRequest[] = [];

  for (let i = 1; i <= patientCount; i++) {
    const patient: Patient = {
      id: `P-${String(i).padStart(4, "0")}`,
      displayName: pick(random, SURNAMES) + pick(random, GIVEN_NAMES),
      birthYear: intBetween(random, 1940, 2015),
      region: random() < 0.75 ? clinicRegion : pick(random, SIDO),
      telehealthException: random() < 0.15 ? pick(random, EXCEPTION_SAMPLES) : null,
    };
    patients.push(patient);

    // Up to ~10 months back, so some visits fall outside a 6-month window. Oldest first.
    const daysAgo = Array.from({ length: intBetween(random, 0, 4) }, () => intBetween(random, 1, 300)).sort(
      (a, b) => b - a,
    );
    let lastCondition: (typeof CONDITIONS)[number] | undefined;
    for (const ago of daysAgo) {
      const condition = pick(random, CONDITIONS);
      visits.push({
        id: `V-${String(visits.length + 1).padStart(5, "0")}`,
        patientId: patient.id,
        date: format(subDays(todayDate, ago), "yyyy-MM-dd"),
        mode: random() < 0.75 ? "in_person" : "telehealth",
        kcdCode: condition.kcdCode,
        note: pick(random, condition.notes),
      });
      lastCondition = condition;
    }

    if (random() < 0.7) {
      // Mostly the same complaint as last time, sometimes something new.
      const condition = lastCondition && random() < 0.6 ? lastCondition : pick(random, CONDITIONS);
      const hour = String(intBetween(random, 9, 17)).padStart(2, "0");
      const minute = String(intBetween(random, 0, 59)).padStart(2, "0");
      requests.push({
        id: `R-${String(requests.length + 1).padStart(4, "0")}`,
        patientId: patient.id,
        symptomText: pick(random, condition.requestPhrases),
        requestedAt: `${today}T${hour}:${minute}:00+09:00`,
      });
    }
  }

  return { generatedFrom: { seed, today }, patients, visits, requests };
}
