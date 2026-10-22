import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "재진 확인 콘솔 (데모)",
  description: "비대면 진료 대상 확인과 처방 제한을 돕는 가상 데이터 데모",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
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
            <p className="text-lg font-bold text-accent">재진 확인 콘솔</p>
            <TextSizeToggle />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
