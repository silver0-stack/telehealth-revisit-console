import { cookies } from "next/headers";
import { DEFAULT_ROLE, RoleSchema, type Role } from "@/domain/roles";

// The demo has no login: visitors pick a role on screen and it is kept in a cookie. Server actions
// still check the role, because they accept any POST, not only the buttons the screen shows.
export const ROLE_COOKIE = "demo-role";

export async function getRole(): Promise<Role> {
  const parsed = RoleSchema.safeParse((await cookies()).get(ROLE_COOKIE)?.value);
  return parsed.success ? parsed.data : DEFAULT_ROLE;
}
