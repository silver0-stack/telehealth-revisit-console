import { expect, test } from "@playwright/test";

// The core clinician flow, end to end, against a fresh server (in-memory state starts empty).
// Steps build on each other (decisions show up in the audit log), so they run in order.
test.describe.configure({ mode: "serial" });

test("오늘 할 일 shows the open work, oldest request first, and keyboard users can skip to content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘 할 일" })).toBeVisible();
  await expect(page.locator("dl > div").filter({ hasText: "검토 대기" })).toContainText("26");
  const nextUp = page.getByRole("heading", { name: /다음 검토/ }).locator("xpath=../..").getByRole("listitem");
  await expect(nextUp).toHaveCount(5);
  await expect(nextUp.first()).toContainText("2026-10-20 09:00");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
});

test("synthetic-data notice folds into a header badge and opens again, and is never gone", async ({ page }) => {
  await page.goto("/reviews");
  await page.getByRole("button", { name: "안내 접기" }).click();
  await expect(page.getByText("모든 데이터는 가상입니다")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "가상 데이터" })).toBeVisible();

  // The folded state is remembered on the next screen too.
  await page.goto("/audit");
  await expect(page.getByRole("button", { name: "가상 데이터" })).toBeVisible();

  await page.getByRole("button", { name: "가상 데이터" }).click();
  await expect(page.getByText("모든 데이터는 가상입니다")).toBeVisible();
});

test("text size toggle enlarges the whole page and says its state", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /큰 글씨/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
});

test("승인: a confident suggestion is approved, the request is follow-up, and the prescription passes", async ({ page }) => {
  await page.goto("/reviews/R-0012");
  await expect(page.getByText("자동 제안(규칙 기반) · 최종 판단은 의사")).toBeVisible();
  await expect(page.getByText(/이전 진료와 같은 증상으로 보여요/)).toBeVisible();

  await page.getByRole("button", { name: "승인", exact: true }).click();
  await expect(page.getByText("승인했어요.")).toBeVisible();
  await expect(page.getByText("일반 비대면진료 (재진)")).toBeVisible();

  await page.getByRole("link", { name: "처방 확인으로 이동" }).click();
  await page.getByLabel("약", { exact: true }).selectOption("DRG-001");
  await page.getByLabel("처방일수", { exact: true }).fill("14");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("아목시실린 14일 · 규칙상 차단 없음")).toBeVisible();
  await expect(page.getByText("용량과 기간이 적절한지는 의사가 판단해요.")).toBeVisible();
});

test("수정하고 승인: an unclear suggestion is not pre-selected, and a first visit is limited to 7 days", async ({ page }) => {
  await page.goto("/reviews/R-0001");
  await expect(page.getByText("의사 확인 필요")).toBeVisible();
  await expect(page.getByRole("button", { name: "승인", exact: true })).toBeDisabled();

  await page.getByLabel("진단 코드 직접 고르기").selectOption("I10");
  await page.getByRole("button", { name: "수정하고 승인" }).click();
  await expect(page.getByText("수정하고 승인했어요.")).toBeVisible();
  // The status title starts with an aria-hidden icon ("!"), so match the end of the text.
  await expect(page.getByText(/초진 비대면진료$/)).toBeVisible();

  await page.getByRole("link", { name: "처방 확인으로 이동" }).click();
  await page.getByLabel("약", { exact: true }).selectOption("DRG-003");
  await page.getByLabel("처방일수", { exact: true }).fill("14");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("암로디핀 14일 · 규칙상 차단")).toBeVisible();
  await expect(page.getByText(/초진은 7일까지 처방할 수 있어요/)).toBeVisible();
});

test("보류: holding needs a reason and is shown on the request", async ({ page }) => {
  await page.goto("/reviews/R-0002");
  await page.getByLabel("보류 이유").fill("환자에게 증상 추가 확인 필요");
  await page.getByRole("button", { name: "보류", exact: true }).click();
  await expect(page.getByText("보류했어요.")).toBeVisible();
  await expect(page.getByText(/이유: 환자에게 증상 추가 확인 필요/)).toBeVisible();
});

test("역할: an admin can look at a review but only a doctor can decide it", async ({ page }) => {
  await page.goto("/reviews/R-0003");
  await page.getByRole("button", { name: "관리자" }).click();
  await expect(page.getByRole("button", { name: "관리자" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("관리자 역할에서는 볼 수만 있어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "수정하고 승인" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "보류", exact: true })).toBeDisabled();
});

test("감사 로그: every decision above was recorded with the suggestion shown at the time", async ({ page }) => {
  await page.goto("/audit");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "R-0012" })).toContainText("미리 선택");
  await expect(rows.filter({ hasText: "R-0012" })).toContainText("검토 대기 → 승인");
  await expect(rows.filter({ hasText: "R-0012" })).toContainText("재진 판단");
  await expect(rows.filter({ hasText: "R-0001" })).toContainText("수정하고 승인");
  await expect(rows.filter({ hasText: "R-0002" })).toContainText("보류: 환자에게 증상 추가 확인 필요");
});

test("규칙: a new version can only be saved by an admin, after its impact preview", async ({ page }) => {
  await page.goto("/admin/rules");
  await page.getByRole("button", { name: "관리자" }).click();
  await expect(page.getByRole("button", { name: "이대로 새 버전으로 저장" })).toHaveCount(0);

  await page.getByLabel(/이부프로펜/).check();
  await page.getByLabel(/변경 이유/).fill("E2E 테스트: 이부프로펜 개별 차단");
  await page.getByRole("button", { name: "영향 미리보기" }).click();
  await expect(page.getByRole("heading", { name: /저장 전 영향 미리보기/ })).toBeVisible();

  await page.getByRole("button", { name: "이대로 새 버전으로 저장" }).click();
  await expect(page.getByText("v3 버전으로 저장했어요")).toBeVisible();
  await expect(page.getByRole("heading", { name: "지금 적용 중: v3" })).toBeVisible();
});

test("규칙 비교: moving from the 30-day placeholder to the draft rules shows who is affected", async ({ page }) => {
  await page.goto("/admin/rules/impact?from=v1&to=v2");
  await expect(page.locator("dl > div").filter({ hasText: "새로 재진이 됨" })).toContainText("27건");
  await expect(page.locator("dl > div").filter({ hasText: "비대면진료 불가로" })).toContainText("2건");
});

test("데모 초기화: an admin brings back the starting state, and the reset itself is logged", async ({ page }) => {
  await page.goto("/admin/rules");
  await expect(page.getByText("초기화는 관리자만 할 수 있어요")).toBeVisible();
  await page.getByRole("button", { name: "관리자" }).click();

  await page.getByLabel(/지워지는 것을 확인했어요/).check();
  await page.getByRole("button", { name: "데모 초기화" }).click();
  await expect(page.getByText("데모를 처음 상태로 되돌렸어요")).toBeVisible();
  await expect(page.getByRole("heading", { name: "지금 적용 중: v2" })).toBeVisible();

  await page.goto("/audit");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("데모 초기화");

  await page.goto("/reviews/R-0012");
  await expect(page.getByText("검토 대기")).toBeVisible();
});
