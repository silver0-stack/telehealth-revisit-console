"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRole } from "@/app/role";
import { ROLE_ACTOR } from "@/components/labels";
import { appendAuditEvent } from "@/data/audit-log";
import { resetDemo } from "@/data/demo-reset";
import { computeImpact } from "@/data/impact";
import { getRules, saveRuleVersion } from "@/data/rules";
import { can } from "@/domain/roles";
import { draftFromForm, parseRuleForm, readerFromFormData } from "./form";

// Only reachable from the preview screen's confirm button, so a version is saved only after its
// impact was shown. Server actions accept any POST, so the role is checked here as well as on screen.
export async function saveRulesAction(formData: FormData) {
  const role = await getRole();
  if (!can(role, "rules.save")) redirect(`/admin/rules?error=FORBIDDEN_ROLE`);

  const parsed = parseRuleForm(readerFromFormData(formData));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    redirect(`/admin/rules?error=${encodeURIComponent(fields.join(","))}`);
  }

  const current = await getRules();
  // Someone saved another version after this preview was made: the preview no longer shows the
  // real impact, so refuse instead of saving on stale information.
  if (current.version !== parsed.data.baseVersion) redirect(`/admin/rules?error=STALE_PREVIEW`);

  const actor = ROLE_ACTOR[role];
  const saved = await saveRuleVersion(draftFromForm(current, parsed.data), actor);
  const impact = await computeImpact(current, saved);
  await appendAuditEvent({
    actor,
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

export async function resetDemoAction(formData: FormData) {
  const role = await getRole();
  if (!can(role, "demo.reset")) redirect(`/admin/rules?error=FORBIDDEN_ROLE`);
  // A second, explicit step instead of a browser confirm dialog: the checkbox says what will be lost.
  if (formData.get("confirm") !== "on") redirect(`/admin/rules?error=RESET_CONFIRM`);

  await resetDemo(ROLE_ACTOR[role]);
  revalidatePath("/", "layout");
  redirect(`/admin/rules?reset=1`);
}
