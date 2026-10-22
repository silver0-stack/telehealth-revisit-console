import { z } from "zod";

// Calendar date in Asia/Seoul, e.g. "2026-10-20". Visits are day-granular, so we
// avoid a time component (and timezone bugs) on purpose.
export const IsoDateSchema = z.iso.date();

// Instant with an explicit offset, e.g. "2026-10-20T09:30:00+09:00".
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const PatientSchema = z.object({
  id: z.string().regex(/^P-\d{4}$/),
  displayName: z.string().min(1),
  birthYear: z.number().int().min(1900).max(2026),
});
export type Patient = z.infer<typeof PatientSchema>;

export const VisitModeSchema = z.enum(["in_person", "telehealth"]);
export type VisitMode = z.infer<typeof VisitModeSchema>;

export const VisitSchema = z.object({
  id: z.string().regex(/^V-\d{5}$/),
  patientId: PatientSchema.shape.id,
  date: IsoDateSchema,
  mode: VisitModeSchema,
  kcdCode: z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/),
  note: z.string(),
});
export type Visit = z.infer<typeof VisitSchema>;

export const TelehealthRequestSchema = z.object({
  id: z.string().regex(/^R-\d{4}$/),
  patientId: PatientSchema.shape.id,
  symptomText: z.string().min(1),
  requestedAt: IsoDateTimeSchema,
});
export type TelehealthRequest = z.infer<typeof TelehealthRequestSchema>;

export const DatasetSchema = z.object({
  generatedFrom: z.object({ seed: z.number().int(), today: IsoDateSchema }),
  patients: z.array(PatientSchema),
  visits: z.array(VisitSchema),
  requests: z.array(TelehealthRequestSchema),
});
export type Dataset = z.infer<typeof DatasetSchema>;
