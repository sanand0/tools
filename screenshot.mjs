import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const rel = args[0];
const out = args[1];
const hIdx = args.indexOf("--height");
const height = hIdx > -1 ? Number(args[hIdx + 1]) : 0;
if (!rel || !out || (hIdx > -1 && !height)) {
  console.log("Usage: npm run screenshot -- <tool/> <output.webp|png> [--height px]");
  process.exit(1);
}

const root = path.dirname(fileURLToPath(import.meta.url));
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(root, p);
  try {
    const st = await fs.stat(fp);
    if (st.isDirectory()) fp = path.join(fp, "index.html");
    const data = await fs.readFile(fp);
    const ext = path.extname(fp).slice(1);
    const mime =
      {
        html: "text/html; charset=utf-8",
        js: "text/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        svg: "image/svg+xml",
      }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
const port = await new Promise((r) => server.listen(0, () => r(server.address().port)));
const url = `http://localhost:${port}/${rel}`;

const browser = await chromium.launch();
const context = await browser.newContext(height ? { viewport: { width: 1280, height } } : {});
const page = await context.newPage();
await page.goto(url);
await page.waitForLoadState("networkidle");
const tmp = `${out}.tmp.png`;
await page.screenshot({ path: tmp, type: "png", fullPage: !height });
await browser.close();
server.close();

if (out.endsWith(".webp")) {
  const buf = await sharp(tmp).png({ palette: true, colours: 16 }).toBuffer();
  await sharp(buf).webp({ lossless: true }).toFile(out);
} else {
  await sharp(tmp).png({ palette: true, colours: 256 }).toFile(out);
}
await fs.unlink(tmp);
