import { DrugSchema, type Drug } from "../domain/types.ts";

// Small demo catalog. Codes (DRG-xxx) are made up; names are generic ingredient names.
// ASSUMPTION (A10): the category of each drug is a demo assignment, not the official list.
// The real lists come from 식약처/보건복지부 notices (고시), and some are not published yet.
export const DRUGS: readonly Drug[] = [
  { code: "DRG-001", name: "아목시실린", use: "세균 감염 (항생제)", category: "general" },
  { code: "DRG-002", name: "이부프로펜", use: "통증, 열", category: "general" },
  { code: "DRG-003", name: "암로디핀", use: "고혈압", category: "general" },
  { code: "DRG-004", name: "메트포르민", use: "2형 당뇨", category: "general" },
  { code: "DRG-005", name: "세티리진", use: "알레르기, 가려움", category: "general" },
  { code: "DRG-006", name: "에스오메프라졸", use: "위산 역류, 속쓰림", category: "general" },
  { code: "DRG-007", name: "졸피뎀", use: "불면", category: "narcotic_psychotropic" },
  { code: "DRG-008", name: "알프라졸람", use: "불안", category: "narcotic_psychotropic" },
  { code: "DRG-009", name: "펜터민", use: "체중 감량", category: "narcotic_psychotropic" },
  { code: "DRG-010", name: "세마글루타이드", use: "체중 감량", category: "obesity_treatment" },
  { code: "DRG-011", name: "오르리스타트", use: "체중 감량", category: "obesity_treatment" },
  { code: "DRG-012", name: "이소트레티노인", use: "심한 여드름", category: "misuse_risk" },
].map((d) => DrugSchema.parse(d));

export function findDrug(code: string): Drug | undefined {
  return DRUGS.find((d) => d.code === code);
}

// Which demo drug a past visit for each condition would typically have produced. Used only by the seed.
export const TYPICAL_DRUG_BY_KCD: Readonly<Record<string, string>> = {
  "J02.9": "DRG-001",
  "J06.9": "DRG-002",
  "J30.4": "DRG-005",
  I10: "DRG-003",
  "E11.9": "DRG-004",
  "M54.5": "DRG-002",
  "K21.9": "DRG-006",
  "L20.9": "DRG-005",
  "G43.9": "DRG-002",
};
