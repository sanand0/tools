import { Browser } from "happy-dom";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const servers = [{ url: "https://test/", directory: root }];
if (fs.existsSync(path.join(root, "vendor")))
  servers.push(
    { url: "https://cdn.jsdelivr.net/npm/", directory: path.join(root, "vendor/npm") },
    {
      url: "https://llmfoundry.straive.com/-/proxy/https://news.ycombinator.com/",
      directory: path.join(root, "vendor/news.ycombinator.com"),
    },
    {
      url: "https://llmfoundry.straive.com/-/proxy/https://www.hntoplinks.com/",
      directory: path.join(root, "vendor/www.hntoplinks.com"),
    }
  );

const browser = new Browser({
  console,
  settings: { fetch: { virtualServers: servers } },
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
