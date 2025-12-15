#!/usr/bin/env node
import { chromium } from "playwright";

// Scans the currently-rendered WhatsApp Web chat (via CDP) for quote extraction anomalies.
// Useful when iterating on selectors without injecting the bookmarklet script.

async function main() {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes("web.whatsapp.com"));
  if (!page) {
    console.error("No WhatsApp Web tab found. Open https://web.whatsapp.com/ first.");
    process.exit(1);
  }

  const result = await page.evaluate(() => {
    const normalize = (value) => (value || "").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

    const getTextWithEmojis = (element, { stripSelectors } = {}) => {
      if (!element) return null;
      const clone = element.cloneNode(true);
      for (const selector of stripSelectors || []) {
        for (const el of clone.querySelectorAll(selector)) el.remove();
      }
      for (const el of clone.querySelectorAll("[data-plain-text]")) el.replaceWith(el.dataset.plainText);
      for (const img of clone.querySelectorAll("img.emoji[alt]")) img.replaceWith(img.alt);
      return clone.textContent || "";
    };

    const extractQuoteText = (quoteElement, selectable) => {
      if (!quoteElement) return null;
      const mentions = [...quoteElement.querySelectorAll(".quoted-mention")].filter(
        (n) => !(selectable && selectable.contains(n)),
      );
      const candidates = mentions.length ? mentions : [...quoteElement.querySelectorAll(".quoted-mention")];
      if (!candidates.length) return null;
      let best = null;
      for (const node of candidates) {
        const text = getTextWithEmojis(node, { stripSelectors: [".selectable-text"] })?.trim();
        if (!text) continue;
        if (!best || text.length > best.length) best = text;
      }
      return best?.trim() || null;
    };

    const rows = [...document.querySelectorAll('#main [role="row"]')];
    const quoteRows = [];
    for (const row of rows) {
      const quote = row.querySelector('[aria-label="Quoted message" i]');
      if (!quote) continue;
      const rowId = row.querySelector("[data-id]")?.dataset?.id || null;
      const selectable = row.querySelector(".selectable-text");
      const rawText = normalize(selectable?.textContent);
      const quoteText = extractQuoteText(quote, selectable);
      quoteRows.push({
        rowId,
        rawText,
        quoteText,
      });
    }

    // If any `quoteText` contains the reply's own message text, we likely captured duplication
    // (or the quote actually contains the same text). Review these manually.
    const quoteDupes = quoteRows.filter((r) => {
      const rt = normalize(r.rawText);
      const qt = normalize(r.quoteText);
      if (!rt || !qt) return false;
      return qt.includes(rt) && qt !== rt;
    });

    return {
      visibleRows: rows.length,
      visibleQuotes: quoteRows.length,
      quoteDupesCount: quoteDupes.length,
      quoteDupes: quoteDupes.slice(0, 5),
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
