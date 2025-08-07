import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

const convert = async (page, json) => {
  await page.fill("#jsonInput", json);
  await page.click("#convertBtn");
};

test("converts simple JSON", async ({ page }) => {
  await convert(
    page,
    JSON.stringify([
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ]),
  );
  await expect(page.locator("#output th")).toHaveText(["name", "age"]);
  await expect(page.locator("#output tbody tr").first().locator("td")).toHaveText(["John", "30"]);
  await expect(page.locator("#downloadBtn")).toBeVisible();
  await expect(page.locator("#copyBtn")).toBeVisible();
});

test("handles nested JSON", async ({ page }) => {
  await convert(page, JSON.stringify([{ name: "Peter", details: { age: 40, city: "New York" } }]));
  await expect(page.locator("#output th")).toHaveText(["name", "details.age", "details.city"]);
});

test("handles object input", async ({ page }) => {
  await convert(page, JSON.stringify({ name: "Alice", age: 25, place: { country: "Canada", city: "Ottawa" } }));
  await expect(page.locator("#output th")).toHaveText(["name", "age", "place.country", "place.city"]);
});

test("shows error for invalid JSON", async ({ page }) => {
  await convert(page, "invalid json");
  await expect(page.locator(".toast-body")).toContainText("Invalid JSON input");
  await expect(page.locator("#downloadBtn")).toBeHidden();
  await expect(page.locator("#copyBtn")).toBeHidden();
});

test("shows error for empty input", async ({ page }) => {
  await convert(page, "");
  await expect(page.locator(".toast-body")).toContainText("Please enter some JSON data");
  await expect(page.locator("#downloadBtn")).toBeHidden();
  await expect(page.locator("#copyBtn")).toBeHidden();
});

test("copies CSV to clipboard", async ({ page }) => {
  await convert(page, JSON.stringify([{ name: "Copy Test", value: 123 }]));
  await page.click("#copyBtn");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("name\tvalue\nCopy Test\t123");
  await expect(page.locator(".toast-body")).toHaveText("Copied to clipboard!");
});

test("prepares download", async ({ page }) => {
  await expect(page.locator("#downloadBtn")).toBeHidden();
  await convert(page, JSON.stringify([{ name: "Download Test", value: 456 }]));
  await expect(page.locator("#downloadBtn")).toBeVisible();
});
