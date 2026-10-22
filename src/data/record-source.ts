import type { Patient, TelehealthRequest, Visit } from "../domain/types.ts";

// The app reads patient records only through this interface, so the in-memory
// mock can later be swapped for SQLite or a FHIR source (M7) without touching UI code.
export interface RecordSource {
  listPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  listVisits(patientId: string): Promise<Visit[]>;
  listRequests(): Promise<TelehealthRequest[]>;
}
