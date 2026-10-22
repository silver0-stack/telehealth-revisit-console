"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRules, saveRuleVersion } from "@/data/rules";
import { DrugCategorySchema, DrugSchema } from "@/domain/types";

const FormSchema = z
  .object({
    blockedCategories: z.array(DrugCategorySchema),
    blockedDrugCodes: z.array(DrugSchema.shape.code),
    limitEnabled: z.boolean(),
    maxDays: z.coerce.number().int().min(1).max(365),
    extendedMaxDays: z.coerce.number().int().min(1).max(365),
    extendedTimesPerPatient: z.coerce.number().int().min(0).max(10),
    note: z.string().trim().min(5).max(200),
  })
  .refine((d) => !d.limitEnabled || d.extendedMaxDays >= d.maxDays, { path: ["extendedMaxDays"] });

// Server actions can be called by any POST request, not only this form. The demo has no login
// (see README), so this is where a real app would check that the user is an admin.
export async function saveRulesAction(formData: FormData) {
  const parsed = FormSchema.safeParse({
    blockedCategories: formData.getAll("blockedCategories"),
    blockedDrugCodes: formData.getAll("blockedDrugCodes"),
    limitEnabled: formData.get("limitEnabled") === "on",
    maxDays: formData.get("maxDays"),
    extendedMaxDays: formData.get("extendedMaxDays"),
    extendedTimesPerPatient: formData.get("extendedTimesPerPatient"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    redirect(`/admin/rules?error=${encodeURIComponent(fields.join(","))}`);
  }

  const { version: baseVersion, ...base } = getRules();
  const d = parsed.data;
  const saved = saveRuleVersion(
    {
      ...base,
      source: `관리자 화면에서 수정 (${baseVersion} 기반): ${d.note}`,
      prescription: {
        blockedCategories: d.blockedCategories,
        blockedDrugCodes: d.blockedDrugCodes,
        firstVisitLimit: d.limitEnabled
          ? { maxDays: d.maxDays, extendedMaxDays: d.extendedMaxDays, extendedTimesPerPatient: d.extendedTimesPerPatient }
          : null,
      },
    },
    "데모 관리자",
  );

  revalidatePath("/admin/rules");
  revalidatePath("/prescriptions");
  redirect(`/admin/rules?saved=${saved.version}`);
}
