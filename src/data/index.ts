import { MockRecordSource } from "./mock-record-source.ts";
import type { RecordSource } from "./record-source.ts";

let source: RecordSource | undefined;

// One shared instance per server process; swap the class here to change the backend.
export function getRecordSource(): RecordSource {
  source ??= new MockRecordSource();
  return source;
}
