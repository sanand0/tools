import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const routeVendor = (page, target, file) =>
  page.route(target, (r) => r.fulfill({ path: new URL(`../vendor/${file}`, import.meta.url).pathname }));

test.beforeEach(async ({ page }) => {
  await routeVendor(
    page,
    "https://llmfoundry.straive.com/-/proxy/https://news.ycombinator.com/",
    "news.ycombinator.com/index.html",
  );
  await routeVendor(
    page,
    "https://llmfoundry.straive.com/-/proxy/https://www.hntoplinks.com/week",
    "www.hntoplinks.com/week",
  );
  await page.goto(url);
});

test("scrapes Hacker News links", async ({ page }) => {
  await page.click("#scrapeButton");
  await page.waitForTimeout(100);
  const text = await page.locator("#linksTextArea").inputValue();
  const lines = text.trim().split("\n");
  expect(lines.length).toBeGreaterThan(10);
  expect(lines.every((l) => /^\[.*\]\(http/.test(l))).toBe(true);
  await page.click("#copyButton");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(text);
});

test("scrapes HN Top Links", async ({ page }) => {
  await page.selectOption("#sourceUrl", "https://www.hntoplinks.com/week");
  await page.click("#scrapeButton");
  await page.waitForTimeout(100);
  const text = await page.locator("#linksTextArea").inputValue();
  expect(text.split("\n").length).toBeGreaterThan(10);
});
