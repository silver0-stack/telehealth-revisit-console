import type { EligibilityResult, NotFollowUpReason, RegionCheck } from "@/domain/eligibility";
import type { PrescriptionCheck } from "@/domain/prescription";
import type { Period } from "@/domain/rules";
import type { DrugCategory } from "@/domain/types";

// All user-facing wording for domain codes lives here, so the domain stays language-free
// and the same action or reason always reads the same way across screens.

export const CATEGORY_LABEL: Record<DrugCategory, string> = {
  general: "제한 분류 아님",
  narcotic_psychotropic: "마약·향정신성의약품",
  misuse_risk: "오·남용 우려 의약품",
  obesity_treatment: "비만치료제",
};

export function periodLabel(p: Period): string {
  return p.unit === "month" ? `${p.amount}개월` : `${p.amount}일`;
}

export const ELIGIBILITY_TITLE: Record<EligibilityResult["kind"], string> = {
  follow_up: "일반 비대면진료 (재진)",
  first_visit: "초진 비대면진료",
  not_allowed: "비대면진료 불가",
};

export function notFollowUpText(reason: NotFollowUpReason, window: Period): string {
  switch (reason) {
    case "NO_VISIT":
      return "이 의원의 진료 기록이 없어요.";
    case "ONLY_TELEHEALTH_VISITS":
      return "비대면 진료 기록만 있어요. 재진 근거는 대면 진료 기록만 인정돼요.";
    case "NO_MATCHING_SYMPTOM":
      return "같은 증상으로 대면 진료한 기록이 없어요.";
    case "OUTSIDE_WINDOW":
      return `같은 증상의 대면 진료 기록이 있지만 ${periodLabel(window)}이 지났어요.`;
  }
}

export function regionText(region: RegionCheck, patientRegion: string): string {
  switch (region) {
    case "NOT_REQUIRED":
      return "이 규칙 버전은 초진 지역을 확인하지 않아요.";
    case "SAME_REGION":
      return `환자 거주지(${patientRegion})가 의원과 같은 시·도예요.`;
    case "EXCEPTION_CATEGORY":
      return `환자 거주지(${patientRegion})는 다른 시·도지만, 지역 예외 대상이에요.`;
    case "OUTSIDE_REGION":
      return `환자 거주지(${patientRegion})가 의원과 다른 시·도이고 지역 예외 대상도 아니에요. 대면 진료를 안내하세요.`;
  }
}

export function prescriptionText(check: PrescriptionCheck, categoryLabel: string, extensionUsedOn: string | null): string {
  const max = check.maxDays;
  switch (check.reason) {
    case "ALLOWED":
      return max === null ? "이 규칙 버전에서는 처방일수 제한이 없어요." : `초진은 ${max}일까지 처방할 수 있어요.`;
    case "ALLOWED_FIRST_VISIT_EXTENSION":
      return `초진 예외로 ${max}일까지 처방할 수 있어요. 이 환자의 예외 1회를 사용해요.`;
    case "TELEHEALTH_NOT_ALLOWED":
      return "비대면진료가 불가한 요청이라 처방할 수 없어요.";
    case "BLOCKED_CATEGORY":
      return `${categoryLabel}은(는) 비대면진료로 처방할 수 없어요.`;
    case "BLOCKED_DRUG":
      return "이 약은 규칙 관리 화면의 차단 목록에 있어요.";
    case "FIRST_VISIT_OVER_MAX_DAYS":
      return `초진은 ${max}일까지 처방할 수 있어요. 처방일수를 줄이거나, 기존 치료를 계속해야 하면 아래 두 항목을 확인하세요.`;
    case "EXTENSION_NEEDS_HISTORY":
      return "초진 예외를 쓰려면 해당 질환의 진료·처방 이력을 확인해야 해요.";
    case "EXTENSION_OVER_MAX_DAYS":
      return `초진 예외를 써도 ${max}일까지만 처방할 수 있어요. 처방일수를 줄이세요.`;
    case "EXTENSION_ALREADY_USED":
      return `이 환자는 초진 예외를 이미 사용했어요${extensionUsedOn ? ` (${extensionUsedOn})` : ""}. ${max}일 이내로 줄이세요.`;
  }
}
