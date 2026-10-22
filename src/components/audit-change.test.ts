import { describe, expect, it } from "vitest";
import { describeChange } from "./audit-change.ts";

const request = { type: "request" as const, id: "R-0012" };
const rules = { type: "rules" as const, id: "v3" };

const prescription = {
  blockedCategories: ["narcotic_psychotropic", "misuse_risk", "obesity_treatment"],
  blockedDrugCodes: [],
  firstVisitLimit: { maxDays: 7, extendedMaxDays: 30, extendedTimesPerPatient: 1 },
};
const impactCounts = {
  lostFollowUp: 0,
  gainedFollowUp: 0,
  lostTelehealth: 0,
  gainedTelehealth: 0,
  newlyBlocked: 2,
  newlyAllowed: 0,
};

describe("describeChange", () => {
  it("describes an approval with the eligibility it produced", () => {
    const rows = describeChange({
      subject: request,
      before: { status: "pending" },
      after: {
        status: "approved",
        kcdCode: "J02.9",
        editedSuggestion: false,
        eligibility: { kind: "follow_up", ruleVersion: "v2", evidenceVisitId: "V-00048", windowEnd: "2027-01-26" },
      },
    });
    expect(rows).toEqual([
      { label: "상태", before: "검토 대기", after: "승인" },
      { label: "진단 코드", before: "—", after: "J02.9 급성 인두염" },
      { label: "재진 판단", before: null, after: "일반 비대면진료 (재진) (근거 방문 V-00048, 2027-01-26까지, 규칙 v2)" },
    ]);
  });

  it("gives the short reason when the result is not a follow-up", () => {
    const rows = describeChange({
      subject: request,
      before: { status: "held", reason: "확인 필요" },
      after: {
        status: "approved",
        kcdCode: "M54.5",
        editedSuggestion: true,
        eligibility: { kind: "first_visit", ruleVersion: "v2", notFollowUp: "NO_MATCHING_SYMPTOM", region: "SAME_REGION" },
      },
    });
    expect(rows?.[0]).toEqual({ label: "상태", before: "보류 (확인 필요)", after: "승인" });
    expect(rows?.[2]?.after).toBe("초진 비대면진료 (같은 증상 대면 기록 없음, 규칙 v2)");
  });

  it("describes a hold without an eligibility row", () => {
    const rows = describeChange({
      subject: request,
      before: { status: "pending" },
      after: { status: "held", reason: "환자에게 증상 추가 확인 필요" },
    });
    expect(rows).toEqual([{ label: "상태", before: "검토 대기", after: "보류 (환자에게 증상 추가 확인 필요)" }]);
  });

  it("shows only the rule fields that changed, plus the impact counts", () => {
    const rows = describeChange({
      subject: rules,
      before: { version: "v2", prescription },
      after: { version: "v3", prescription: { ...prescription, blockedDrugCodes: ["DRG-002"] }, impactCounts },
    });
    expect(rows?.map((r) => r.label)).toEqual(["규칙 버전", "개별 차단 약", "저장 전 영향"]);
    expect(rows?.[1]).toEqual({ label: "개별 차단 약", before: "없음", after: "이부프로펜" });
    expect(rows?.[2]?.after).toContain("새로 차단 2");
  });

  it("returns null for a shape it does not know, so the page shows the raw JSON instead", () => {
    expect(describeChange({ subject: request, before: { status: "unknown" }, after: null })).toBeNull();
    expect(describeChange({ subject: rules, before: null, after: { version: "v3" } })).toBeNull();
  });
});
