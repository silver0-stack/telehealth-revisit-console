import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every main screen, checked against WCAG 2.0/2.1 A and AA. Runs on desktop and on a phone-sized viewport.
const PAGES = [
  { name: "오늘 할 일", path: "/" },
  { name: "검토 목록", path: "/reviews" },
  { name: "검토 상세", path: "/reviews/R-0012" },
  { name: "처방 확인 (빈 화면)", path: "/prescriptions" },
  { name: "처방 확인 (결과)", path: "/prescriptions?patientId=P-0004&kcd=J02.9&drug=DRG-001&days=14" },
  { name: "감사 로그", path: "/audit" },
  { name: "규칙 관리", path: "/admin/rules" },
  { name: "규칙 버전 비교", path: "/admin/rules/impact?from=v1&to=v2" },
];

for (const { name, path } of PAGES) {
  test(`${name}: synthetic-data banner and no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText("모든 데이터는 가상입니다")).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    // Readable failure message: rule id plus the elements that broke it.
    const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(summary).toEqual([]);
  });
}
