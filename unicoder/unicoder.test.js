import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Unicoder tests", async () => {
  let window, document, markdownInput, unicodeInput, outputElement, markdownOutput, copyButton, markdownCopyButton;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    markdownInput = document.getElementById("markdown-input");
    unicodeInput = document.getElementById("unicode-input");
    outputElement = document.getElementById("output");
    markdownOutput = document.getElementById("markdown-output");
    copyButton = document.getElementById("copy-button");
    markdownCopyButton = document.getElementById("copy-markdown-button");
  });

  const triggerInput = (element, value) => {
    element.value = value;
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  const sampleMarkdown = `# Heading 1

This is **bold** and _italic_ text.

> Blockquote line

\`\`\`
code block
\`\`\`

This is \`inline code\`

[Link text](https://example.com)

![Alt text for image](image.jpg)

- Item one
- Item two`;

  it("encodes supported markdown into styled unicode", () => {
    triggerInput(markdownInput, sampleMarkdown);
    const text = outputElement.textContent;

    expect(text).toContain("𝗛𝗲𝗮𝗱𝗶𝗻𝗴 1");
    expect(text).toContain("𝗯𝗼𝗹𝗱");
    expect(text).toContain("𝘪𝘵𝘢𝘭𝘪𝘤");
    expect(text).toContain("𝘉𝘭𝘰𝘤𝘬𝘲𝘶𝘰𝘵𝘦 𝘭𝘪𝘯𝘦");
    expect(text).toContain("𝚌𝚘𝚍𝚎 𝚋𝚕𝚘𝚌𝚔");
    expect(text).toContain("𝚒𝚗𝚕𝚒𝚗𝚎 𝚌𝚘𝚍𝚎");
    expect(text).toContain("Link text (https://example.com)");
    expect(text).toContain("Alt text for image");
    expect(text).toContain("• Item one");
    expect(text).toContain("• Item two");
  });

  it("decodes styled unicode back to markdown", () => {
    triggerInput(markdownInput, sampleMarkdown);
    triggerInput(unicodeInput, outputElement.textContent.trim());

    const decoded = markdownOutput.textContent.trim();
    expect(decoded).toContain("# Heading 1");
    expect(decoded).toContain("**bold**");
    expect(decoded).toContain("_italic_");
    expect(decoded).toContain("> Blockquote line");
    expect(decoded).toContain("```\ncode block\n```");
    expect(decoded).toContain("`inline` `code`");
    expect(decoded).toContain("[Link text](https://example.com)");
    expect(decoded).toContain("Alt text for image");
    expect(decoded).toContain("- Item one");
    expect(decoded).toContain("- Item two");
  });

  it("copies formatted unicode output", async () => {
    triggerInput(markdownInput, "**test content**");
    copyButton.click();

    expect(await window.navigator.clipboard.readText()).toBe(outputElement.innerText);
    expect(copyButton.textContent).toBe("Copied!");
    expect(copyButton.classList.contains("btn-success")).toBe(true);
  });

  it("copies decoded markdown output", async () => {
    triggerInput(unicodeInput, "𝗯𝗼𝗹𝗱");
    markdownCopyButton.click();

    expect(await window.navigator.clipboard.readText()).toBe(markdownOutput.innerText);
    expect(markdownCopyButton.textContent).toBe("Copied!");
    expect(markdownCopyButton.classList.contains("btn-success")).toBe(true);
  });
});
