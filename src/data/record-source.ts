import type { Patient, PrescriptionRecord, TelehealthRequest, Visit } from "../domain/types.ts";

// The app reads patient records only through this interface, so the in-memory
// mock can later be swapped for SQLite or a FHIR source (M7) without touching UI code.
export interface RecordSource {
  /** The date the app treats as today. The mock returns the seed's fixed date so the demo is reproducible. */
  getToday(): Promise<string>;
  listPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  listVisits(patientId: string): Promise<Visit[]>;
  listRequests(): Promise<TelehealthRequest[]>;
  listPrescriptions(patientId: string): Promise<PrescriptionRecord[]>;
}
