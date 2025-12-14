#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.dirname(new URL(import.meta.url).pathname);
const codePath = path.join(root, "whatsappscraper.min.js");

async function main() {
  const code = await fs.readFile(codePath, "utf8");

  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes("web.whatsapp.com"));
  if (!page) {
    console.error("No WhatsApp Web tab found. Open https://web.whatsapp.com/ first.");
    process.exit(1);
  }

  await page.evaluate(async (src) => {
    const blob = new Blob([src], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, code);

  const { preview, total } = await page.evaluate(() => {
    const list = whatsappscraper.whatsappMessages(document);
    const best =
      list.find((m) => m.linkSite === "thinkingmachines.ai") ||
      list.find((m) => typeof m.linkSite === "string" && /thinkingmachines\\.ai/i.test(m.linkSite)) ||
      list.find((m) => typeof m.text === "string" && /thinkingmachines\\.ai/i.test(m.text)) ||
      list.find((m) => m.linkTitle) ||
      null;
    return { preview: best, total: list.length };
  });

  console.log(`Loaded ${total} messages.`);
  if (!preview) {
    console.log("No link preview message found in the currently-rendered chat.");
    process.exit(2);
  }
  console.log(JSON.stringify(preview, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
