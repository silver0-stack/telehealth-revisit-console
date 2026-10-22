import { diffRules, type PatientRecord, type RuleDiff } from "../domain/rule-diff.ts";
import type { Rules } from "../domain/rules.ts";
import { CLINIC } from "./clinic.ts";
import { DRUGS } from "./drugs.ts";
import { getRecordSource } from "./index.ts";

export async function loadPatientRecords(): Promise<PatientRecord[]> {
  const source = getRecordSource();
  const patients = await source.listPatients();
  return Promise.all(
    patients.map(async (patient) => ({
      patient,
      visits: await source.listVisits(patient.id),
      prescriptions: await source.listPrescriptions(patient.id),
    })),
  );
}

/** Impact of replacing `from` with `to` for every demo patient, as of the demo's "today". */
export async function computeImpact(from: Rules, to: Rules): Promise<RuleDiff> {
  const [records, today] = await Promise.all([loadPatientRecords(), getRecordSource().getToday()]);
  return diffRules(from, to, records, {
    clinicRegion: CLINIC.region,
    requestedAt: `${today}T09:00:00+09:00`,
    drugs: DRUGS,
  });
}
