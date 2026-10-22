import { z } from "zod";

// Calendar date in Asia/Seoul, e.g. "2026-10-20". Visits are day-granular, so we
// avoid a time component (and timezone bugs) on purpose.
export const IsoDateSchema = z.iso.date();

// Instant with an explicit offset, e.g. "2026-10-20T09:30:00+09:00".
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

// The 17 first-level administrative regions (시·도). First-visit telehealth compares the
// patient's region with the clinic's, so we store the region and nothing finer.
export const SIDO = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도",
] as const;
export const SidoSchema = z.enum(SIDO);
export type Sido = z.infer<typeof SidoSchema>;

export const PatientSchema = z.object({
  id: z.string().regex(/^P-\d{4}$/),
  displayName: z.string().min(1),
  birthYear: z.number().int().min(1900).max(2026),
  /** Region of the registered address (or of a registered actual residence). */
  region: SidoSchema,
  /**
   * Category that may let the patient use first-visit telehealth outside their region
   * (e.g. "rare_disease"). Which codes count is decided by the rules file, not here.
   */
  telehealthException: z.string().regex(/^[a-z0-9_]+$/).nullable(),
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
