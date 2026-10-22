import { describe, expect, it } from "vitest";
import { applyReviewAction, type ReviewState } from "./review.ts";

const pending: ReviewState = { status: "pending" };
const held: ReviewState = { status: "held", reason: "환자 연락 대기" };
const approved: ReviewState = { status: "approved", kcdCode: "J02.9", editedSuggestion: false };

describe("applyReviewAction", () => {
  it("approves the pre-selected suggestion", () => {
    expect(applyReviewAction(pending, { type: "approve", suggestedKcdCode: "J02.9" })).toEqual({
      ok: true,
      next: { status: "approved", kcdCode: "J02.9", editedSuggestion: false },
    });
  });

  it("refuses plain approval when nothing was pre-selected", () => {
    expect(applyReviewAction(pending, { type: "approve", suggestedKcdCode: null })).toEqual({
      ok: false,
      error: "NO_SUGGESTION_TO_APPROVE",
    });
  });

  it("marks an edit-and-approve as edited", () => {
    const result = applyReviewAction(pending, { type: "edit_approve", kcdCode: "I10" });
    expect(result).toEqual({ ok: true, next: { status: "approved", kcdCode: "I10", editedSuggestion: true } });
  });

  it("holds with a trimmed reason", () => {
    expect(applyReviewAction(pending, { type: "hold", reason: "  증상 추가 확인  " })).toEqual({
      ok: true,
      next: { status: "held", reason: "증상 추가 확인" },
    });
  });

  it("requires a reason to hold", () => {
    expect(applyReviewAction(pending, { type: "hold", reason: "   " })).toEqual({
      ok: false,
      error: "HOLD_REASON_REQUIRED",
    });
  });

  it("lets a held request be approved later", () => {
    expect(applyReviewAction(held, { type: "edit_approve", kcdCode: "J02.9" }).ok).toBe(true);
  });

  it("never changes an approved review", () => {
    for (const action of [
      { type: "approve", suggestedKcdCode: "J02.9" },
      { type: "edit_approve", kcdCode: "I10" },
      { type: "hold", reason: "다시 보기" },
    ] as const) {
      expect(applyReviewAction(approved, action)).toEqual({ ok: false, error: "ALREADY_APPROVED" });
    }
  });
});
