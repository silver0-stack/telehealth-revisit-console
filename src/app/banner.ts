import { cookies } from "next/headers";

// The synthetic-data notice can be folded into a small header badge, but never removed:
// every screen must say that all data is synthetic (hard rule 1).
export const BANNER_COOKIE = "demo-banner";

export async function isBannerCollapsed(): Promise<boolean> {
  return (await cookies()).get(BANNER_COOKIE)?.value === "collapsed";
}
