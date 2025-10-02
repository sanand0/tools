// @ts-check
import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolsPath = path.join(__dirname, "tools.json");

describe("home page tools list", () => {
  it("places Bootstrap Theme Picker above Page to Markdown", async () => {
    const raw = await fs.readFile(toolsPath, "utf8");
    const { tools } = JSON.parse(raw);
    const titles = tools.map((tool) => tool.title);
    const pickerIndex = titles.indexOf("Bootstrap Theme Picker");
    const pageIndex = titles.indexOf("Page to Markdown");
    expect(pickerIndex).not.toBe(-1);
    expect(pageIndex).not.toBe(-1);
    expect(pickerIndex).toBe(pageIndex - 1);
  });
});
