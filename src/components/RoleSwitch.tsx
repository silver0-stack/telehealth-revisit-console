"use client";

import { usePathname } from "next/navigation";
import { setRoleAction } from "@/app/role-actions";
import type { Role } from "@/domain/roles";
import { ROLE_LABEL } from "./labels";

// A plain form, so switching works without JavaScript; the pathname only brings the visitor back.
export function RoleSwitch({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <form action={setRoleAction} className="flex items-center gap-1">
      <input type="hidden" name="returnTo" value={pathname} />
      <span id="role-label" className="mr-1 text-text-muted">
        역할
      </span>
      <div role="group" aria-labelledby="role-label" className="flex gap-1">
        {Object.entries(ROLE_LABEL).map(([value, label]) => (
          <button
            key={value}
            type="submit"
            name="role"
            value={value}
            aria-pressed={value === role}
            className={`rounded border px-3 py-1 ${
              value === role ? "border-accent bg-accent text-accent-contrast" : "border-border bg-surface text-text hover:border-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}
