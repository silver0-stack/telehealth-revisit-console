const seoulParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "2026-10-20 09:30" in Seoul time, whatever the server's timezone. Same shape as visit dates
 * (yyyy-MM-dd) so dates line up across screens, as in clinical records.
 */
export function formatSeoul(iso: string): string {
  const p = Object.fromEntries(seoulParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
