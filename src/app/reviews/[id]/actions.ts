"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRecordSource } from "@/data";
import { appendAuditEvent } from "@/data/audit-log";
import { CLINIC } from "@/data/clinic";
import { KCD_NAMES } from "@/data/kcd";
import { getReview, getSuggestion, saveReview, type SuggestionRecord } from "@/data/reviews";
import { getRules } from "@/data/rules";
import type { AuditSuggestion } from "@/domain/audit";
import { toSeoulDate } from "@/domain/dates";
import { checkEligibility } from "@/domain/eligibility";
import { applyReviewAction, type ReviewAction } from "@/domain/review";
import { can } from "@/domain/roles";
import { ROLE_ACTOR } from "@/components/labels";
import { getRole } from "@/app/role";
import { writableSandbox } from "@/app/sandbox";

const FormSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("approve"), requestId: z.string() }),
  z.object({
    intent: z.literal("edit_approve"),
    requestId: z.string(),
    kcdCode: z.string().refine((k) => k in KCD_NAMES),
  }),
  z.object({ intent: z.literal("hold"), requestId: z.string(), reason: z.string().max(200) }),
]);

// Flattens what the clinician saw into the audit record, including the threshold in force.
function toAuditSuggestion({ suggestion, minConfidence }: SuggestionRecord): AuditSuggestion {
  const candidate =
    suggestion.kind === "preselect" ? suggestion.candidate : suggestion.kind === "needs_review" ? suggestion.best : null;
  return {
    outcome: suggestion.kind,
    visitId: candidate?.visitId ?? null,
    kcdCode: candidate?.kcdCode ?? null,
    label: candidate?.match.label ?? null,
    probabilities: candidate?.match.probabilities ?? null,
    matcher: candidate?.match.matcher ?? null,
    minConfidence,
  };
}

// Server actions accept any POST, not only this form, so the role is checked here and not only by
// disabling buttons. The demo has no login (see README): the role comes from the on-screen switch.
export async function reviewAction(formData: FormData) {
  const parsed = FormSchema.safeParse(Object.fromEntries(formData));
  const requestId = String(formData.get("requestId") ?? "");
  const back = `/reviews/${encodeURIComponent(requestId)}`;
  const role = await getRole();
  if (!can(role, "review.decide")) redirect(`${back}?error=FORBIDDEN_ROLE`);
  if (!parsed.success) redirect(`${back}?error=INVALID_INPUT`);
  const form = parsed.data;

  const source = getRecordSource();
  const request = (await source.listRequests()).find((r) => r.id === form.requestId);
  const patient = request ? await source.getPatient(request.patientId) : undefined;
  if (!request || !patient) redirect(`/reviews?error=NOT_FOUND`);

  const requestDate = toSeoulDate(request.requestedAt);
  const suggestionRecord = await getSuggestion(request, requestDate);
  const preselected =
    suggestionRecord.suggestion.kind === "preselect" ? suggestionRecord.suggestion.candidate.kcdCode : null;

  const action: ReviewAction =
    form.intent === "approve"
      ? { type: "approve", suggestedKcdCode: preselected }
      : form.intent === "edit_approve"
        ? { type: "edit_approve", kcdCode: form.kcdCode }
        : { type: "hold", reason: form.reason };

  const sandbox = await writableSandbox();
  const current = await getReview(sandbox, request.id);
  const transition = applyReviewAction(current.state, action);
  if (!transition.ok) redirect(`${back}?error=${transition.error}`);
  const next = transition.next;

  const rules = await getRules(sandbox);
  const eligibility =
    next.status === "approved"
      ? checkEligibility(
          {
            patient,
            clinicRegion: CLINIC.region,
            requestedAt: request.requestedAt,
            symptomKcdCode: next.kcdCode,
            visits: await source.listVisits(patient.id),
          },
          rules,
        )
      : null;

  await saveReview(sandbox, request.id, { state: next, eligibility });
  await appendAuditEvent(sandbox, {
    actor: ROLE_ACTOR[role],
    action: form.intent === "approve" ? "review.approve" : form.intent === "edit_approve" ? "review.edit_approve" : "review.hold",
    subject: { type: "request", id: request.id },
    before: current.state,
    after: eligibility ? { ...next, eligibility } : next,
    suggestion: toAuditSuggestion(suggestionRecord),
    decision:
      next.status === "approved"
        ? `${next.kcdCode} ${KCD_NAMES[next.kcdCode] ?? ""} 확정 (규칙 ${rules.version})`
        : next.status === "held"
          ? `보류: ${next.reason}`
          : null,
  });

  revalidatePath("/reviews");
  revalidatePath(back);
  revalidatePath("/audit");
  redirect(`${back}?done=${form.intent}`);
}
