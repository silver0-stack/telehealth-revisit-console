import { defineConfig, devices } from "@playwright/test";

// E2E runs against its own production server on port 3100 with MATCHER=rules, so it never
// touches the dev server's in-memory state and never spends AI Gateway credits.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /a11y\.spec\.ts/ },
  ],
  webServer: {
    command: "pnpm build && pnpm start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 240_000,
    env: { MATCHER: "rules" },
  },
});
