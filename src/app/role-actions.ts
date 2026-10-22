"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RoleSchema } from "@/domain/roles";
import { ROLE_COOKIE } from "./role";

export async function setRoleAction(formData: FormData) {
  const role = RoleSchema.parse(formData.get("role"));
  (await cookies()).set(ROLE_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  // Only same-site paths, so the form cannot be used to send someone to another website.
  const returnTo = String(formData.get("returnTo") ?? "/");
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
}
