import { defineConfig, devices } from "@playwright/test";

const existingServerURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: existingServerURL ?? "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: existingServerURL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
