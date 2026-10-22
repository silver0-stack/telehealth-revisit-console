import { addDays, addMonths, format, parseISO, subDays } from "date-fns";
import type { Period } from "./rules.ts";

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

// Korea has no daylight saving time, so a fixed +09:00 offset is exact and we avoid a timezone library.
export function toSeoulDate(isoDateTime: string): string {
  const ms = Date.parse(isoDateTime);
  if (Number.isNaN(ms)) throw new Error(`Not a valid ISO date-time: ${isoDateTime}`);
  return new Date(ms + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Last day (inclusive) of a period that starts on `startDate`, e.g. "6 months from the visit".
 *
 * ASSUMPTION (A3): counted like the Civil Act (민법 제157조, 제160조): the start day itself is not
 * counted, and the period ends on the day before the matching day of the last unit. If that month
 * has no matching day, it ends on the last day of the month.
 * 2026-04-20 + 6 months -> 2026-10-20, 2026-04-30 + 6 months -> 2026-10-31,
 * 2026-08-31 + 6 months -> 2027-02-28, 2026-09-20 + 30 days -> 2026-10-20.
 */
export function periodEnd(startDate: string, period: Period): string {
  const countFrom = addDays(parseISO(startDate), 1);
  const afterEnd =
    period.unit === "day" ? addDays(countFrom, period.amount) : addMonths(countFrom, period.amount);
  return format(subDays(afterEnd, 1), "yyyy-MM-dd");
}
