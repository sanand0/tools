import { Browser } from "happy-dom";

export function newBrowser({ directory, ...settings }) {
  return new Browser({
    // console,
    settings: { ...settings, fetch: { virtualServers: [{ url: "https://test/", directory }] } },
  });
}

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

export async function loadFrom(dirname, file = "") {
  const browser = newBrowser({ directory: dirname });
  const page = browser.newPage();
  return await load(page, `https://test/${file}`);
}
