import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test("extracts non-ASCII from text input", async ({ page }) => {
  await page.fill("#textInput", "Hello 😊 World αβγ");
  await page.click("#readText");
  await expect(page.locator(".char-btn .char-display")).toHaveText(["😊", "α", "β", "γ"]);
});

test("shows message when none found", async ({ page }) => {
  await page.fill("#textInput", "Hello World 123");
  await page.click("#readText");
  await expect(page.locator("#charContainer")).toContainText("No non-ASCII characters found.");
});

test("extracts from clipboard", async ({ page }) => {
  await page.evaluate(() => navigator.clipboard.writeText("Clipboard test: 😊 Σ Ω"));
  await page.click("#readClipboard");
  await page.waitForTimeout(100);
  await expect(page.locator(".char-btn .char-display")).toHaveText(["😊", "Σ", "Ω"]);
});

test("copies character to clipboard", async ({ page }) => {
  await page.fill("#textInput", "Test: α");
  await page.click("#readText");
  const btn = page.locator(".char-btn").first();
  await btn.click();
  await page.waitForTimeout(50);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("α");
  await expect(btn).toHaveClass(/btn-success/);
  await page.waitForTimeout(550);
  await expect(btn).not.toHaveClass(/btn-success/);
});
