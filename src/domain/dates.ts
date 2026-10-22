const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

// Korea has no daylight saving time, so a fixed +09:00 offset is exact and we avoid a timezone library.
export function toSeoulDate(isoDateTime: string): string {
  const ms = Date.parse(isoDateTime);
  if (Number.isNaN(ms)) throw new Error(`Not a valid ISO date-time: ${isoDateTime}`);
  return new Date(ms + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}
