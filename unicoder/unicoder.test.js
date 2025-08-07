import { test, expect } from "@playwright/test";

const url = new URL("index.html", import.meta.url).href;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

const fill = async (page, text) => {
  await page.fill("#markdown-input", text);
};

test("encodes markdown to unicode", async ({ page }) => {
  await fill(page, "**bold** _italic_ `code`");
  await expect(page.locator("#output")).toHaveText("𝗯𝗼𝗹𝗱 𝘪𝘵𝘢𝘭𝘪𝘤 𝚌𝚘𝚍𝚎");
});

test("copies formatted output", async ({ page }) => {
  await fill(page, "**test content**");
  await page.click("#copy-button");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("𝘁𝗲𝘀𝘁 𝗰𝗼𝗻𝘁𝗲𝗻𝘁\n");
  const btn = page.locator("#copy-button");
  await expect(btn).toHaveText("Copied!");
  await expect(btn).toHaveClass(/btn-success/);
});
