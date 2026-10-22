import { DatasetSchema, type Dataset } from "../domain/types.ts";
import type { RecordSource } from "./record-source.ts";
import seed from "./seed.json" with { type: "json" };

// In-memory only: data resets on every server restart. Documented in the README.
export class MockRecordSource implements RecordSource {
  private readonly data: Dataset;

  constructor(raw: unknown = seed) {
    // Validate at the boundary: a hand-edited seed.json fails loudly here.
    this.data = DatasetSchema.parse(raw);
  }

  async getToday() {
    return this.data.generatedFrom.today;
  }

  async listPatients() {
    return this.data.patients;
  }

  async getPatient(id: string) {
    return this.data.patients.find((p) => p.id === id);
  }

  async listVisits(patientId: string) {
    return this.data.visits.filter((v) => v.patientId === patientId);
  }

  async listRequests() {
    return this.data.requests;
  }

  async listPrescriptions(patientId: string) {
    return this.data.prescriptions.filter((r) => r.patientId === patientId);
  }
}
