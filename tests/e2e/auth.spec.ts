import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../../src/lib/auth/demo-accounts";

test("private dashboard redirects an anonymous visitor to login", async ({ page }, testInfo) => {
  await page.goto("/documents");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("login-mobile.png"), fullPage: true });
});

test("demo buttons fill the form without signing in", async ({ page }) => {
  await page.goto("/login");
  for (const account of DEMO_ACCOUNTS) {
    await page.getByRole("button", { name: `Use ${account.name.toLowerCase()}` }).click();
    await expect(page.getByLabel("Email address")).toHaveValue(account.email);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("invalid credentials show an error and keep the user signed out", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("invalid-login@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/);
});

for (const account of DEMO_ACCOUNTS) {
  test(`${account.name} can sign in, stay signed in after refresh, and sign out`, async ({ page }) => {
    test.skip(process.env.E2E_DEMO_ACCOUNTS_READY !== "1", "Create the two confirmed Supabase demo users, then set E2E_DEMO_ACCOUNTS_READY=1.");
    await page.goto("/login");
    await page.getByRole("button", { name: `Use ${account.name.toLowerCase()}` }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/documents$/, { timeout: 20_000 });
    await expect(page.getByText(account.email, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(account.email, { exact: true })).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/documents$/);
    await page.getByRole("link", { name: "Shared with me" }).click();
    await expect(page).toHaveURL(/view=shared/);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });
}
