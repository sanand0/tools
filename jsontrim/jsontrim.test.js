import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

const trim = async (page, json, len) => {
  await page.fill("#inputJson", JSON.stringify(json));
  await page.fill("#maxLength", String(len));
  await page.click("#trimButton");
};

test("trims strings to max length", async ({ page }) => {
  await trim(page, { name: "John Doe", description: "A long description that needs trimming." }, 10);
  await expect(page.locator("#outputJson")).toHaveValue('{"name":"John Doe","description":"A long des"}');
  await expect(page.locator("#copyButton")).toBeEnabled();
  await expect(page.locator("#error-container")).toBeEmpty();
});

test("handles nested objects and arrays", async ({ page }) => {
  const json = {
    user: { name: "Jane Smith", bio: "Loves coding and long walks" },
    tags: ["developer", "javascript", "web enthusiast"],
  };
  await trim(page, json, 8);
  await expect(page.locator("#outputJson")).toHaveValue(
    '{"user":{"name":"Jane Smi","bio":"Loves co"},"tags":["develope","javascri","web enth"]}',
  );
});

test("does not trim numbers or booleans", async ({ page }) => {
  const json = { id: 1234567890, active: true, value: 123.456789 };
  await trim(page, json, 5);
  await expect(page.locator("#outputJson")).toHaveValue(JSON.stringify(json));
});

test("shows error for invalid JSON", async ({ page }) => {
  await page.fill("#inputJson", "invalid json");
  await page.fill("#maxLength", "5");
  await page.click("#trimButton");
  await expect(page.locator("#outputJson")).toHaveValue("");
  await expect(page.locator("#copyButton")).toBeDisabled();
  await expect(page.locator("#error-container")).toContainText("Invalid JSON input");
});

test("shows error if max length < 1", async ({ page }) => {
  await trim(page, { name: "Test" }, 0);
  await expect(page.locator("#outputJson")).toHaveValue("");
  await expect(page.locator("#copyButton")).toBeDisabled();
  await expect(page.locator("#error-container")).toContainText("Maximum length must be at least 1");
});

test("copies trimmed JSON", async ({ page }) => {
  await trim(page, { message: "Hello World, this is a test for copy." }, 15);
  await page.click("#copyButton");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('{"message":"Hello World, th"}');
  await expect(page.locator("#copyButton")).toHaveText(/Copied!/);
});

test("persists input via localStorage", async ({ page }) => {
  const text = '{ "test": "save" }';
  await page.fill("#inputJson", text);
  await page.dispatchEvent("#inputJson", "input");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jsonTrimmer.input"))).toBe(text);
  await page.evaluate(() => localStorage.setItem("jsonTrimmer.input", '{ "loaded": "yes" }'));
  await page.reload();
  await expect(page.locator("#inputJson")).toHaveValue('{ "loaded": "yes" }');
});
