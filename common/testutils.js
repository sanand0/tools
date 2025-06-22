import { Browser } from "happy-dom";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const browser = new Browser({
  console,
  settings: { fetch: { virtualServers: [{ url: "https://test/", directory: root }] } },
});

export async function load(page, url) {
  await page.goto(url);
  await page.waitUntilComplete();
  // Manually dispatch due to https://github.com/capricorn86/happy-dom/issues/1692
  page.mainFrame.document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  return {
    page,
    window: page.mainFrame.window,
    document: page.mainFrame.document,
    body: page.mainFrame.document.documentElement,
  };
}

export async function loadFrom(dirPath, file = "index.html") {
  const page = browser.newPage();
  return await load(page, `https://test/${path.basename(dirPath)}/${file}`);
}

export async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
