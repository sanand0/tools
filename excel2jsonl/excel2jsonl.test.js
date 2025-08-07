import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

const type = async (page, value) => {
  await page.fill("#input", value);
  await page.dispatchEvent("#input", "input");
  await page.waitForTimeout(100);
};

test("converts TSV to JSONL", async ({ page }) => {
  await type(page, "name\tage\nJohn\t30\nJane\t25\n");
  await expect(page.locator("#output")).toHaveValue('{"name":"John","age":"30"}\n{"name":"Jane","age":"25"}');
  await expect(page.locator("#downloadBtn")).toBeEnabled();
  await expect(page.locator(".toast-body")).toHaveText("Conversion successful!");
});

test("shows error for invalid TSV", async ({ page }) => {
  await type(page, 'name\tage\n"John\t30');
  await expect(page.locator("#output")).toHaveValue("");
  await expect(page.locator("#downloadBtn")).toBeDisabled();
});

test("handles empty input", async ({ page }) => {
  await type(page, "");
  await expect(page.locator("#output")).toHaveValue("");
  await expect(page.locator("#downloadBtn")).toBeDisabled();
});

test("copies JSONL", async ({ page }) => {
  await type(page, "name\tvalue\nCopy Test\t123");
  await page.click("#copyBtn");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('{"name":"Copy Test","value":"123"}');
  await expect(page.locator(".toast-body")).toHaveText("Copied to clipboard!");
});

test("prepares download", async ({ page }) => {
  await type(page, "name\tvalue\nDownload Test\t456");
  await expect(page.locator("#downloadBtn")).toBeEnabled();
});
