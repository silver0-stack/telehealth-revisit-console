"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "환자 목록" },
  { href: "/prescriptions", label: "처방 확인" },
  { href: "/admin/rules", label: "규칙 관리" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴">
      <ul className="flex flex-wrap gap-1">
        {LINKS.map(({ href, label }) => {
          const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`block rounded px-3 py-1 ${current ? "bg-accent text-accent-contrast" : "text-text hover:underline"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
