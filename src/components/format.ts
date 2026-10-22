const seoulDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "short",
  timeStyle: "short",
});

/** "2026. 10. 20. 오전 9:30" in Seoul time, whatever the server's timezone. */
export function formatSeoul(iso: string): string {
  return seoulDateTime.format(new Date(iso));
}
