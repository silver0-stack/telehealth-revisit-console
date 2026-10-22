"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { BANNER_COOKIE } from "./banner";

export async function setBannerAction(formData: FormData) {
  const jar = await cookies();
  if (formData.get("collapsed") === "1") {
    jar.set(BANNER_COOKIE, "collapsed", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  } else {
    jar.delete(BANNER_COOKIE);
  }
  // Re-render the current page in place; the layout reads the cookie again.
  revalidatePath("/", "layout");
}
