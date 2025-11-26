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

This is **"bold" text** and _italic_ text.

> Blockquote line

\`\`\`
// This is fenced code
function hello() {
  return "world";
}
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
    expect(text).toContain("𝚃𝚑𝚒𝚜 𝚒𝚜 𝚏𝚎𝚗𝚌𝚎𝚍 𝚌𝚘𝚍𝚎");
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
    expect(decoded).toContain("**\"bold\" text**");
    expect(decoded).toContain("_italic_");
    expect(decoded).toContain("> Blockquote line");
    expect(decoded).toContain("```\n// This is fenced code\nfunction hello() {\n  return \"world\";\n}\n```");
    expect(decoded).toContain("`inline code`");
    expect(decoded).toContain("[Link text](https://example.com)");
    expect(decoded).toContain("Alt text for image");
    expect(decoded).toContain("- Item one");
    expect(decoded).toContain("- Item two");
  });

  it("decodes inline bold text without promoting to heading", () => {
    const unicode = "\"𝗯𝗼𝗹𝗱\" 𝘁𝗲𝘅𝘁 here";
    triggerInput(unicodeInput, unicode);

    expect(markdownOutput.textContent.trim()).toBe('**"bold" text** here');
  });

  it("reconstructs blockquotes without splitting words", () => {
    triggerInput(unicodeInput, "𝘛𝘩𝘪𝘴 𝘪𝘴 𝘢 𝘣𝘭𝘰𝘤𝘬𝘲𝘶𝘰𝘵𝘦\n");

    expect(markdownOutput.textContent.trim()).toBe("> This is a blockquote");
  });

  it("restores fenced code blocks", () => {
    const unicode = `// 𝚃𝚑𝚒𝚜 𝚒𝚜 𝚏𝚎𝚗𝚌𝚎𝚍 𝚌𝚘𝚍𝚎\n𝚏𝚞𝚗𝚌𝚝𝚒𝚘𝚗 𝚑𝚎𝚕𝚕𝚘() {\n  𝚛𝚎𝚝𝚞𝚛𝚗 "𝚠𝚘𝚛𝚕𝚍";\n}`;

    triggerInput(unicodeInput, unicode);

    expect(markdownOutput.textContent.trim()).toBe(
      "```\n// This is fenced code\nfunction hello() {\n  return \"world\";\n}\n```",
    );
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
