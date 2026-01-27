import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("geminiscraper table handling", () => {
  let window;
  let document;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname, "__fixtures__/table.html"));
  });

  it("converts table blocks into markdown tables", () => {
    const markdown = window.geminiscraper.extractConversation(document);

    expect(markdown).toContain("| Context | Recommended Question | Mechanism |");
    expect(markdown).toContain("| --- | --- | --- |");
    expect(markdown).toContain(
      '| **Universal** | "The crystal ball says it failed. What\'s the story?" | Prospective Hindsight |',
    );
  });

  it("preserves footer text outside the markdown table", () => {
    const markdown = window.geminiscraper.extractConversation(document);

    const tableIndex = markdown.indexOf("| Context | Recommended Question | Mechanism |");
    const footerIndex = markdown.indexOf("Export to Sheets");
    expect(tableIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(tableIndex);
  });

  it("separates table footer text from following headings", () => {
    const markdown = window.geminiscraper.extractConversation(document);
    expect(markdown).toContain("Export to Sheets\n\n### Next Step");
  });
});

describe("geminiscraper user formatting", () => {
  it("treats user paragraphs as single line breaks", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/user-paragraphs.html");
    const markdown = window.geminiscraper.extractConversation(document);
    expect(markdown).toContain("## User\n\nFirst line\nSecond line\n\n");
  });
});
