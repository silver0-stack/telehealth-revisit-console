// State of a clinician's review of one telehealth request. Kept as a tiny pure state machine so
// "what can happen next" is decided in one tested place, not scattered across buttons.

export type ReviewState =
  | { status: "pending" }
  | { status: "held"; reason: string }
  | { status: "approved"; kcdCode: string; editedSuggestion: boolean };

export type ReviewAction =
  /** "승인": accept the pre-selected suggestion as is. */
  | { type: "approve"; suggestedKcdCode: string | null }
  /** "수정하고 승인": the clinician chose the code. */
  | { type: "edit_approve"; kcdCode: string }
  /** "보류": decide later. */
  | { type: "hold"; reason: string };

export type ReviewTransition = { ok: true; next: ReviewState } | { ok: false; error: ReviewError };

export type ReviewError = "ALREADY_APPROVED" | "NO_SUGGESTION_TO_APPROVE" | "HOLD_REASON_REQUIRED";

export function applyReviewAction(current: ReviewState, action: ReviewAction): ReviewTransition {
  // An approved review is final: changing it would silently rewrite what eligibility was based on.
  if (current.status === "approved") return { ok: false, error: "ALREADY_APPROVED" };

  switch (action.type) {
    case "approve":
      // "승인" only exists when something was pre-selected; without it the clinician must choose.
      if (action.suggestedKcdCode === null) return { ok: false, error: "NO_SUGGESTION_TO_APPROVE" };
      return { ok: true, next: { status: "approved", kcdCode: action.suggestedKcdCode, editedSuggestion: false } };
    case "edit_approve":
      return { ok: true, next: { status: "approved", kcdCode: action.kcdCode, editedSuggestion: true } };
    case "hold": {
      const reason = action.reason.trim();
      if (reason.length === 0) return { ok: false, error: "HOLD_REASON_REQUIRED" };
      return { ok: true, next: { status: "held", reason } };
    }
  }
}
