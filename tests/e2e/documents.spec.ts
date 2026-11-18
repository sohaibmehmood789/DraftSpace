import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { DEMO_PASSWORD } from "../../src/lib/auth/demo-accounts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
test.skip(process.env.E2E_DEMO_ACCOUNTS_READY !== "1", "Requires confirmed Supabase demo accounts.");
const createdIds: string[] = [];

async function signIn(page: Page, account = "owner") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Use ${account}` }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/documents$/, { timeout: 20_000 });
}
async function createDocument(page: Page, title: string) {
  await page.getByRole("button", { name: "+ New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/, { timeout: 20_000 });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  createdIds.push(id);
  await page.getByLabel("Document title").fill(title);
  await expect(page.getByRole("textbox", { name: "Document content" })).toBeVisible();
  return id;
}
async function saved(page: Page) {
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 20_000 });
}

test.afterEach(async () => {
  if (!createdIds.length) return;
  // Remove only the disposable fixtures created by this test.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({ email: "owner@example.com", password: DEMO_PASSWORD });
  if (authError) throw authError;
  const { error } = await supabase.from("documents").delete().in("id", createdIds.splice(0));
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
});

test("create, rename, format, save, refresh, and reopen a document", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await signIn(page);
  const title = `Assessment notes ${Date.now()}`;
  await createDocument(page, title);
  const content = page.getByRole("textbox", { name: "Document content" });
  await content.fill("Formatted document");
  await content.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await page.getByRole("button", { name: "Underline", exact: true }).click();
  await page.getByLabel("Text style").selectOption("h2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue(title);
  await expect(content.locator("h2")).toContainText("Formatted document");
  for (const tag of ["strong", "em", "u"]) await expect(content.locator(tag)).toContainText("Formatted document");
  await content.click();
  await content.press("ControlOrMeta+a");
  await content.press("ArrowRight");
  await content.press("Enter");
  await page.getByRole("button", { name: "Bulleted list", exact: true }).click();
  await page.keyboard.type("First bullet");
  await content.press("Enter");
  await content.press("Enter");
  await page.getByRole("button", { name: "Numbered list", exact: true }).click();
  await page.keyboard.type("First numbered item");
  await saved(page);
  await page.reload();
  await expect(content.locator("ul")).toContainText("First bullet");
  await expect(content.locator("ol")).toContainText("First numbered item");
  await page.screenshot({ path: testInfo.outputPath("document-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("document-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "All documents" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("link", { name: title }).click();
  await expect(content.locator("h2")).toContainText("Formatted document");
  await expect(content.locator("ul")).toContainText("First bullet");
});

test("failed autosave keeps edits and Save retries successfully", async ({ page }) => {
  await signIn(page);
  await createDocument(page, `Retry test ${Date.now()}`);
  await saved(page);
  await page.route("**/api/documents/*", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary save failure. Please retry." }) }));
  const content = page.getByRole("textbox", { name: "Document content" });
  await content.fill("Keep these unsaved edits");
  await expect(page.getByRole("status")).toHaveText("Save failed", { timeout: 10_000 });
  await expect(content).toContainText("Keep these unsaved edits");
  await page.unroute("**/api/documents/*");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(content).toContainText("Keep these unsaved edits");
});

test("edits made during a save are queued and persisted", async ({ page }) => {
  await signIn(page);
  await createDocument(page, `Queued save ${Date.now()}`);
  await saved(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  await page.route("**/api/documents/*", async (route) => {
    if (first) { first = false; await held; }
    await route.continue();
  });
  const content = page.getByRole("textbox", { name: "Document content" });
  await content.fill("First revision");
  await expect(page.getByRole("status")).toHaveText("Saving…", { timeout: 10_000 });
  await content.fill("Latest revision while saving");
  release();
  await saved(page);
  await page.reload();
  await expect(content).toHaveText("Latest revision while saving");
});

test("another tab cannot overwrite a newer save; unrelated account cannot open the document", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await signIn(page);
  const id = await createDocument(page, `Access test ${Date.now()}`);
  await saved(page);
  const otherTab = await page.context().newPage();
  await otherTab.goto(`/documents/${id}`);
  await expect(otherTab.getByRole("textbox", { name: "Document content" })).toBeVisible();
  await page.getByRole("textbox", { name: "Document content" }).fill("Saved in the first tab");
  await saved(page);
  await otherTab.getByRole("textbox", { name: "Document content" }).fill("Unsaved in the second tab");
  await expect(otherTab.getByRole("alert").filter({ hasText: "updated in another tab" })).toBeVisible({ timeout: 10_000 });
  await expect(otherTab.getByRole("textbox", { name: "Document content" })).toHaveText("Unsaved in the second tab");
  await otherTab.close();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Document content" })).toHaveText("Saved in the first tab");
  const outsiderContext = await browser.newContext();
  try {
    const outsider = await outsiderContext.newPage();
    await signIn(outsider, "editor");
    await outsider.goto(`/documents/${id}`);
    await expect(outsider.getByRole("heading", { name: "Document unavailable" })).toBeVisible();
    const response = await outsider.request.patch(`/api/documents/${id}`, { data: { title: "Unauthorized", content: { type: "doc", content: [{ type: "paragraph" }] }, updatedAt: "2000-01-01T00:00:00Z" } });
    expect(response.status()).toBe(404);
  } finally { await outsiderContext.close(); }
});

test("import a UTF-8 text file, edit, format, save, and reopen it", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.getByRole("button", { name: "Import file", exact: true }).click();
  await expect(page.getByText("UTF-8 .txt files only", { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("import-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("import-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const title = `Imported notes ${Date.now()}`;
  await page.getByLabel("Choose a text file").setInputFiles({
    name: `${title}.TXT`, mimeType: "text/plain",
    buffer: Buffer.from("\uFEFFHello team 👋\r\n\r\n<script>alert('literal')</script>\r\nSecond paragraph café", "utf8"),
  });
  await page.getByRole("button", { name: "Import document", exact: true }).click();
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/, { timeout: 20_000 });
  createdIds.push(new URL(page.url()).pathname.split("/").at(-1)!);
  await expect(page.getByLabel("Document title")).toHaveValue(title);
  await expect(page.getByText("Owned by you", { exact: true })).toBeVisible();
  const content = page.getByRole("textbox", { name: "Document content" });
  await expect(content).toContainText("Hello team 👋");
  await expect(content).toContainText("Second paragraph café");
  await expect(content).toContainText("<script>alert('literal')</script>");
  await expect(content.locator("script")).toHaveCount(0);
  await expect(content.locator("p").nth(1)).toHaveText("");
  await content.locator("p").first().fill("Hello team 👋 — Added after import");
  await expect(content).toContainText("Second paragraph café");
  await content.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByLabel("Document title").fill(`${title} edited`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue(`${title} edited`);
  await expect(content).toContainText("Second paragraph café");
  await expect(content.locator("strong").filter({ hasText: "Added after import" })).toBeVisible();
  await page.getByRole("button", { name: "All documents" }).click();
  await page.getByRole("link", { name: `${title} edited` }).click();
  await expect(content).toContainText("Hello team 👋");
  await expect(content).toContainText("Added after import");
  await expect(content.locator("strong").filter({ hasText: "Added after import" })).toBeVisible();
});

test("import rejects unsupported, empty, oversized, and invalid text files", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.getByRole("button", { name: "Import file", exact: true }).click();
  const cases = [
    { name: "notes.pdf", buffer: Buffer.from("Not a text file"), error: "Only .txt files", client: true },
    { name: "empty.txt", buffer: Buffer.alloc(0), error: "This file is empty", client: true },
    { name: "oversized.txt", buffer: Buffer.alloc(100 * 1024 + 1, 65), error: "This file is too large", client: true },
    { name: "blank.txt", buffer: Buffer.from(" \n\t"), error: "This file is empty", client: false },
    { name: "malformed.txt", buffer: Buffer.from([0xc3, 0x28]), error: "UTF-8 encoding", client: false },
    { name: "binary.txt", buffer: Buffer.from("text\0binary"), error: "binary or unsupported", client: false },
  ];
  for (const item of cases) {
    await page.getByLabel("Choose a text file").setInputFiles({ name: item.name, mimeType: "application/octet-stream", buffer: item.buffer });
    if (item.client) await expect(page.getByRole("button", { name: "Import document", exact: true })).toBeDisabled();
    else {
      await page.getByRole("button", { name: "Import document", exact: true }).click();
      await expect(page.getByRole("button", { name: "Import document", exact: true })).toBeEnabled();
    }
    await expect(page.getByRole("alert").filter({ hasText: item.error })).toBeVisible();
    await expect(page).toHaveURL(/\/documents$/);
  }
});

test("owner shares with editor, shared edits persist, and revocation blocks access", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  await signIn(page);
  const title = `Shared document ${Date.now()}`;
  const id = await createDocument(page, title);
  await page.getByRole("textbox", { name: "Document content" }).fill("Owner’s original draft");
  await saved(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share document" });
  const grant = dialog.getByRole("button", { name: "Grant access", exact: true });
  await expect(grant).toBeEnabled();
  for (const item of [
    { email: "owner@example.com", error: "already own" },
    { email: "not-registered-sharing@example.com", error: "No registered user" },
  ]) {
    await dialog.getByLabel("Email address").fill(item.email);
    await grant.click();
    await expect(dialog.getByRole("alert").filter({ hasText: item.error })).toBeVisible();
  }
  await dialog.getByLabel("Email address").fill("EDITOR@example.com");
  await grant.click();
  await expect(dialog.getByText("editor@example.com · Can edit", { exact: true })).toBeVisible();
  await dialog.getByLabel("Email address").fill("editor@example.com");
  await grant.click();
  await expect(dialog.getByRole("button", { name: "Remove access for editor@example.com" })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close sharing dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog.getByText("editor@example.com · Can edit", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("sharing-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("sharing-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await dialog.getByRole("button", { name: "Close sharing dialog" }).click();

  const editorContext = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    const editorPage = await editorContext.newPage();
    await signIn(editorPage, "editor");
    await expect(editorPage.getByRole("link", { name: title })).toHaveCount(0);
    await editorPage.getByRole("link", { name: "Shared with me" }).click();
    await expect(editorPage.getByRole("link", { name: title })).toBeVisible();
    await editorPage.getByRole("link", { name: title }).click();
    await expect(editorPage.getByText("Shared with you · Can edit", { exact: true })).toBeVisible();
    await expect(editorPage.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
    await editorPage.getByRole("textbox", { name: "Document content" }).fill("Edited by the shared user");
    await saved(editorPage);
    await editorPage.reload();
    await expect(editorPage.getByRole("textbox", { name: "Document content" })).toHaveText("Edited by the shared user");

    const endpoint = `/api/documents/${id}/sharing`;
    expect((await editorPage.request.get(endpoint)).status()).toBe(403);
    expect((await editorPage.request.post(endpoint, { data: { email: "owner@example.com" } })).status()).toBe(403);
    expect((await editorPage.request.delete(endpoint, { data: { sharedWith: "00000000-0000-0000-0000-000000000000" } })).status()).toBe(403);
    expect((await anonymous.request.get(endpoint)).status()).toBe(401);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Document content" })).toHaveText("Edited by the shared user");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await dialog.getByRole("button", { name: "Remove access for editor@example.com" }).click();
    await expect(dialog.getByText("Only you have access.", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close sharing dialog" }).click();

    await editorPage.getByRole("textbox", { name: "Document content" }).fill("Must not persist after revocation");
    await expect(editorPage.getByRole("status")).toHaveText("Save failed", { timeout: 10_000 });
    await expect(editorPage.getByRole("alert").filter({ hasText: "no longer have access" })).toBeVisible();
    editorPage.once("dialog", (warning) => warning.accept());
    await editorPage.reload();
    await expect(editorPage.getByRole("heading", { name: "Document unavailable" })).toBeVisible();
    await editorPage.goto("/documents?view=shared");
    await expect(editorPage.getByRole("link", { name: title })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Document content" })).toHaveText("Edited by the shared user");
  } finally {
    await editorContext.close();
    await anonymous.close();
  }
});

test("sharing access list can recover from a loading failure", async ({ page }) => {
  await signIn(page);
  await createDocument(page, `Sharing retry ${Date.now()}`);
  await saved(page);
  await page.route("**/sharing", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary loading failure." }) }));
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share document" });
  await expect(dialog.getByRole("alert")).toContainText("Temporary loading failure");
  await expect(dialog.getByRole("button", { name: "Grant access" })).toBeDisabled();
  await page.unroute("**/sharing");
  await dialog.getByRole("button", { name: "Retry loading access" }).click();
  await expect(dialog.getByText("Only you have access.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Grant access" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
