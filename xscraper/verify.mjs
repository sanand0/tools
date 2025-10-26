#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import CDP from 'chrome-remote-interface';

const root = path.dirname(new URL(import.meta.url).pathname);
const codePath = path.join(root, 'xscraper.min.js');

async function main() {
  const code = await fs.readFile(codePath, 'utf8');
  const expression = `${code};xscraper.scrape();`;

  const host = 'localhost';
  const port = 9222;
  const targets = await CDP.List({ host, port });
  const target = targets.find(
    (t) => /x\.com|twitter\.com/.test(t.url) && /\/status\//.test(t.url) && /Ethan|emollick/i.test(t.title + ' ' + t.url),
  ) || targets.find((t) => /x\.com|twitter\.com/.test(t.url));

  if (!target) {
    console.error('No X/Twitter tab found. Open a tweet thread first.');
    process.exit(1);
  }

  const client = await CDP({ host, port, target });
  const { Runtime, Page } = client;
  await Page.enable();
  await Runtime.enable();

  const res = await Runtime.evaluate({ expression, awaitPromise: false, returnByValue: true });
  if (res?.exceptionDetails) {
    console.error('Injection error:', res.exceptionDetails.text);
    process.exit(1);
  }
  console.log('xscraper injected. Looking for capture state…');

  // Poll a few times to report captured count
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const { result } = await Runtime.evaluate({
      expression: '(() => ({ n: Object.keys((window.__xscraperState||{}).tweetsByLink||{}).length }))() ',
      returnByValue: true,
    });
    const n = result?.value?.n ?? 0;
    console.log(`Captured so far: ${n}`);
  }

  console.log('If counts stop growing, click the floating button to copy JSON.');
  await client.close();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
