import { z } from "zod";
import { findDrug } from "../data/drugs.ts";
import { KCD_NAMES } from "../data/kcd.ts";
import type { AuditEvent } from "../domain/audit.ts";
import { DrugCategorySchema } from "../domain/types.ts";
import { CATEGORY_LABEL, ELIGIBILITY_TITLE, NOT_FOLLOW_UP_SHORT, REVIEW_STATUS } from "./labels.ts";

// The audit log stores before/after as raw JSON so it stays a faithful record. This turns the shapes the
// app writes into short Korean rows for people. Only fields that changed are shown, plus facts that exist
// only after the decision (eligibility, impact). Anything unrecognized returns null and the page falls back
// to the raw JSON, so an unexpected shape is visible rather than hidden.

export type ChangeRow = { label: string; before: string | null; after: string };

const ReviewStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("held"), reason: z.string() }),
  z.object({ status: z.literal("approved"), kcdCode: z.string(), editedSuggestion: z.boolean() }),
]);

const EligibilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("follow_up"), ruleVersion: z.string(), evidenceVisitId: z.string(), windowEnd: z.string() }),
  z.object({
    kind: z.enum(["first_visit", "not_allowed"]),
    ruleVersion: z.string(),
    notFollowUp: z.enum(["NO_VISIT", "ONLY_TELEHEALTH_VISITS", "NO_MATCHING_SYMPTOM", "OUTSIDE_WINDOW"]),
  }),
]);

const ReviewAfterSchema = z.intersection(ReviewStateSchema, z.object({ eligibility: EligibilitySchema.optional() }));

const RulesSnapshotSchema = z.object({
  version: z.string(),
  prescription: z.object({
    blockedCategories: z.array(DrugCategorySchema),
    blockedDrugCodes: z.array(z.string()),
    firstVisitLimit: z
      .object({ maxDays: z.number(), extendedMaxDays: z.number(), extendedTimesPerPatient: z.number() })
      .nullable(),
  }),
});

const RulesAfterSchema = RulesSnapshotSchema.extend({
  impactCounts: z.object({
    lostFollowUp: z.number(),
    gainedFollowUp: z.number(),
    lostTelehealth: z.number(),
    gainedTelehealth: z.number(),
    newlyBlocked: z.number(),
    newlyAllowed: z.number(),
  }),
});

export function describeChange(event: Pick<AuditEvent, "subject" | "before" | "after">): ChangeRow[] | null {
  return event.subject.type === "request" ? describeReview(event.before, event.after) : describeRules(event.before, event.after);
}

function describeReview(beforeJson: unknown, afterJson: unknown): ChangeRow[] | null {
  const before = ReviewStateSchema.safeParse(beforeJson);
  const after = ReviewAfterSchema.safeParse(afterJson);
  if (!before.success || !after.success) return null;
  const b = before.data;
  const a = after.data;

  const rows: ChangeRow[] = [];
  pushIfChanged(rows, "상태", statusText(b), statusText(a));
  pushIfChanged(rows, "진단 코드", kcdText(b), kcdText(a));
  if (a.eligibility) {
    const e = a.eligibility;
    const detail =
      e.kind === "follow_up"
        ? `근거 방문 ${e.evidenceVisitId}, ${e.windowEnd}까지`
        : NOT_FOLLOW_UP_SHORT[e.notFollowUp];
    rows.push({ label: "재진 판단", before: null, after: `${ELIGIBILITY_TITLE[e.kind]} (${detail}, 규칙 ${e.ruleVersion})` });
  }
  return rows;
}

function describeRules(beforeJson: unknown, afterJson: unknown): ChangeRow[] | null {
  const before = RulesSnapshotSchema.safeParse(beforeJson);
  const after = RulesAfterSchema.safeParse(afterJson);
  if (!before.success || !after.success) return null;
  const b = before.data;
  const a = after.data;

  const rows: ChangeRow[] = [];
  pushIfChanged(rows, "규칙 버전", b.version, a.version);
  pushIfChanged(rows, "금지 분류", categoriesText(b.prescription.blockedCategories), categoriesText(a.prescription.blockedCategories));
  pushIfChanged(rows, "개별 차단 약", drugsText(b.prescription.blockedDrugCodes), drugsText(a.prescription.blockedDrugCodes));
  pushIfChanged(rows, "초진 처방 일수", limitText(b.prescription.firstVisitLimit), limitText(a.prescription.firstVisitLimit));
  const c = a.impactCounts;
  rows.push({
    label: "저장 전 영향",
    before: null,
    after:
      `재진 제외 ${c.lostFollowUp} · 재진 추가 ${c.gainedFollowUp} · 비대면 불가 ${c.lostTelehealth} · ` +
      `비대면 가능 ${c.gainedTelehealth} · 새로 차단 ${c.newlyBlocked} · 차단 해제 ${c.newlyAllowed}`,
  });
  return rows;
}

function pushIfChanged(rows: ChangeRow[], label: string, before: string, after: string): void {
  if (before !== after) rows.push({ label, before, after });
}

function statusText(s: z.infer<typeof ReviewStateSchema>): string {
  const text = REVIEW_STATUS[s.status].text;
  return s.status === "held" ? `${text} (${s.reason})` : text;
}

function kcdText(s: z.infer<typeof ReviewStateSchema>): string {
  return s.status === "approved" ? `${s.kcdCode} ${KCD_NAMES[s.kcdCode] ?? ""}`.trim() : "—";
}

function categoriesText(categories: readonly z.infer<typeof DrugCategorySchema>[]): string {
  return categories.length === 0 ? "없음" : categories.map((c) => CATEGORY_LABEL[c]).join(", ");
}

function drugsText(codes: readonly string[]): string {
  return codes.length === 0 ? "없음" : codes.map((code) => findDrug(code)?.name ?? code).join(", ");
}

function limitText(limit: z.infer<typeof RulesSnapshotSchema>["prescription"]["firstVisitLimit"]): string {
  if (limit === null) return "제한 없음";
  return `${limit.maxDays}일 (예외 ${limit.extendedMaxDays}일, 환자당 ${limit.extendedTimesPerPatient}회)`;
}
