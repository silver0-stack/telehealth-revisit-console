import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { Logo } from "@/components/Logo";
import { MainNav } from "@/components/MainNav";
import { RoleSwitch } from "@/components/RoleSwitch";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { getRole } from "./role";

// Pretendard 1.3.9 (SIL OFL, license next to the file), self-hosted so the page never calls a font CDN.
// One variable file covers every weight the UI uses.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});
import "./globals.css";

export const metadata: Metadata = {
  title: "솔 · 비대면진료 검토 (데모)",
  description: "비대면 진료 대상 확인과 처방 제한을 돕는 가상 데이터 데모",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const role = await getRole();
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-surface focus:px-3 focus:py-2"
        >
          본문으로 건너뛰기
        </a>
        <DemoBanner />
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 rounded">
              <Logo className="h-8 w-8 flex-none" />
              <span className="text-2xl leading-none font-black tracking-tight text-accent">솔</span>
              <span className="text-text-muted">비대면진료 검토</span>
            </Link>
            <MainNav />
            <div className="flex flex-wrap items-center gap-3">
              <RoleSwitch role={role} />
              <TextSizeToggle />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
