import { z } from "zod";
import type { Rules } from "@/domain/rules";
import { DrugCategorySchema, DrugSchema } from "@/domain/types";

// Shared by the preview (GET, from the URL) and the save action (POST, from FormData), so both
// read the form exactly the same way. Kept out of actions.ts because a "use server" file may only
// export async functions.
export const RuleFormSchema = z
  .object({
    baseVersion: z.string().min(1),
    blockedCategories: z.array(DrugCategorySchema),
    blockedDrugCodes: z.array(DrugSchema.shape.code),
    limitEnabled: z.boolean(),
    maxDays: z.coerce.number().int().min(1).max(365),
    extendedMaxDays: z.coerce.number().int().min(1).max(365),
    extendedTimesPerPatient: z.coerce.number().int().min(0).max(10),
    note: z.string().trim().min(5).max(200),
  })
  .refine((d) => !d.limitEnabled || d.extendedMaxDays >= d.maxDays, { path: ["extendedMaxDays"] });
export type RuleForm = z.infer<typeof RuleFormSchema>;

type Reader = { get(key: string): string | undefined; getAll(key: string): string[] };

export function parseRuleForm(read: Reader) {
  return RuleFormSchema.safeParse({
    baseVersion: read.get("baseVersion") ?? "",
    blockedCategories: read.getAll("blockedCategories"),
    blockedDrugCodes: read.getAll("blockedDrugCodes"),
    limitEnabled: read.get("limitEnabled") === "on",
    maxDays: read.get("maxDays"),
    extendedMaxDays: read.get("extendedMaxDays"),
    extendedTimesPerPatient: read.get("extendedTimesPerPatient"),
    note: read.get("note") ?? "",
  });
}

export function readerFromSearchParams(params: { [key: string]: string | string[] | undefined }): Reader {
  const all = (key: string) => {
    const v = params[key];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };
  return { get: (key) => all(key)[0], getAll: all };
}

export function readerFromFormData(form: FormData): Reader {
  return {
    get: (key) => {
      const v = form.get(key);
      return typeof v === "string" ? v : undefined;
    },
    getAll: (key) => form.getAll(key).filter((v): v is string => typeof v === "string"),
  };
}

/** The rules the form describes, based on `base` (everything the form does not edit is kept). */
export function draftFromForm(base: Rules, d: RuleForm): Omit<Rules, "version"> {
  const { version: baseVersion, ...rest } = base;
  return {
    ...rest,
    source: `관리자 화면에서 수정 (${baseVersion} 기반): ${d.note}`,
    prescription: {
      blockedCategories: d.blockedCategories,
      blockedDrugCodes: d.blockedDrugCodes,
      firstVisitLimit: d.limitEnabled
        ? { maxDays: d.maxDays, extendedMaxDays: d.extendedMaxDays, extendedTimesPerPatient: d.extendedTimesPerPatient }
        : null,
    },
  };
}
