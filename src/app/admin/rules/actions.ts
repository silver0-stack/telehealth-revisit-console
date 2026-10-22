"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAuditEvent } from "@/data/audit-log";
import { computeImpact } from "@/data/impact";
import { getRules, saveRuleVersion } from "@/data/rules";
import { draftFromForm, parseRuleForm, readerFromFormData } from "./form";

// Only reachable from the preview screen's confirm button, so a version is saved only after its
// impact was shown. Server actions accept any POST; the demo has no login (see README), so this is
// where a real app would check that the user is an admin.
export async function saveRulesAction(formData: FormData) {
  const parsed = parseRuleForm(readerFromFormData(formData));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    redirect(`/admin/rules?error=${encodeURIComponent(fields.join(","))}`);
  }

  const current = getRules();
  // Someone saved another version after this preview was made: the preview no longer shows the
  // real impact, so refuse instead of saving on stale information.
  if (current.version !== parsed.data.baseVersion) redirect(`/admin/rules?error=STALE_PREVIEW`);

  const saved = saveRuleVersion(draftFromForm(current, parsed.data), "데모 관리자");
  const impact = await computeImpact(current, saved);
  appendAuditEvent({
    actor: "데모 관리자",
    action: "rules.save",
    subject: { type: "rules", id: saved.version },
    before: { version: current.version, prescription: current.prescription },
    after: { version: saved.version, prescription: saved.prescription, impactCounts: impact.counts },
    suggestion: null,
    decision: parsed.data.note,
  });

  revalidatePath("/admin/rules");
  revalidatePath("/prescriptions");
  redirect(`/admin/rules?saved=${saved.version}`);
}
