import { z } from "zod";

// Who may do what. Kept as a pure table so the rule is tested in one place, and the server actions
// and the screens ask the same question instead of each deciding on their own.
// The demo has no passwords: the role is picked on screen. A real app would get it from a login.

export const RoleSchema = z.enum(["doctor", "admin"]);
export type Role = z.infer<typeof RoleSchema>;

export type Permission = "review.decide" | "rules.save" | "demo.reset";

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Only a clinician may confirm a diagnosis code: that decision is what eligibility is based on.
  doctor: ["review.decide"],
  // Rule versions change what every clinician sees, so they belong to an admin, not to a reviewer.
  admin: ["rules.save", "demo.reset"],
};

export const DEFAULT_ROLE: Role = "doctor";

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}
