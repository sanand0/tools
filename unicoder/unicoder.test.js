import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Unicoder tests", async () => {
  let window, document, markdownInput, unicodeOutput, unicodeInput, markdownOutput;
  let copyButtonMarkdown, copyButtonUnicode;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    markdownInput = document.getElementById("markdown-input");
    unicodeOutput = document.getElementById("unicode-output");
    unicodeInput = document.getElementById("unicode-input");
    markdownOutput = document.getElementById("markdown-output");
    copyButtonMarkdown = document.getElementById("copy-button-markdown");
    copyButtonUnicode = document.getElementById("copy-button-unicode");
  });

  function setMarkdownInput(value) {
    markdownInput.value = value;
    markdownInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  function setUnicodeInput(value) {
    unicodeInput.value = value;
    unicodeInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  // ============================================================================
  // Markdown to Unicode Conversion Tests
  // ============================================================================

  describe("Markdown to Unicode", () => {
    it("should convert bold text", () => {
      setMarkdownInput("**bold text**");
      expect(unicodeOutput.textContent.trim()).toBe("𝗯𝗼𝗹𝗱 𝘁𝗲𝘅𝘁");
    });

    it("should convert italic text", () => {
      setMarkdownInput("*italic text*");
      expect(unicodeOutput.textContent.trim()).toBe("𝘪𝘵𝘢𝘭𝘪𝘤 𝘵𝘦𝘹𝘵");
    });

    it("should convert italic text with underscores", () => {
      setMarkdownInput("_italic text_");
      expect(unicodeOutput.textContent.trim()).toBe("𝘪𝘵𝘢𝘭𝘪𝘤 𝘵𝘦𝘹𝘵");
    });

    it("should convert inline code", () => {
      setMarkdownInput("`code text`");
      expect(unicodeOutput.textContent.trim()).toBe("𝚌𝚘𝚍𝚎 𝚝𝚎𝚡𝚝");
    });

    it("should convert fenced code blocks", () => {
      setMarkdownInput("```\nfunction test() {\n  return 42;\n}\n```");
      const output = unicodeOutput.textContent.trim();
      expect(output).toContain("𝚏𝚞𝚗𝚌𝚝𝚒𝚘𝚗");
      expect(output).toContain("𝚝𝚎𝚜𝚝");
      expect(output).toContain("𝚛𝚎𝚝𝚞𝚛𝚗");
      expect(output).toContain("𝟺𝟸");
    });

    it("should convert heading level 1", () => {
      setMarkdownInput("# Heading One");
      expect(unicodeOutput.textContent.trim()).toBe("𝗛𝗲𝗮𝗱𝗶𝗻𝗴 𝗢𝗻𝗲");
    });

    it("should convert heading level 2", () => {
      setMarkdownInput("## Heading Two");
      expect(unicodeOutput.textContent.trim()).toBe("𝗛𝗲𝗮𝗱𝗶𝗻𝗴 𝗧𝘄𝗼");
    });

    it("should convert heading level 3", () => {
      setMarkdownInput("### Heading Three");
      expect(unicodeOutput.textContent.trim()).toBe("𝗛𝗲𝗮𝗱𝗶𝗻𝗴 𝗧𝗵𝗿𝗲𝗲");
    });

    it("should convert blockquote", () => {
      setMarkdownInput("> This is a quote");
      expect(unicodeOutput.textContent.trim()).toBe("𝘛𝘩𝘪𝘴 𝘪𝘴 𝘢 𝘲𝘶𝘰𝘵𝘦");
    });

    it("should convert links", () => {
      setMarkdownInput("[Click here](https://example.com)");
      expect(unicodeOutput.textContent.trim()).toBe("Click here (https://example.com)");
    });

    it("should convert links with same text as URL", () => {
      setMarkdownInput("[https://example.com](https://example.com)");
      expect(unicodeOutput.textContent.trim()).toBe("https://example.com");
    });

    it("should convert images", () => {
      setMarkdownInput("![Alternative text](image.jpg)");
      expect(unicodeOutput.textContent.trim()).toBe("Alternative text");
    });

    it("should convert images without alt text", () => {
      setMarkdownInput("![](image.jpg)");
      expect(unicodeOutput.textContent.trim()).toBe("Image");
    });

    it("should convert unordered lists", () => {
      setMarkdownInput("- Item 1\n- Item 2\n- Item 3");
      const output = unicodeOutput.textContent.trim();
      expect(output).toContain("• Item 1");
      expect(output).toContain("• Item 2");
      expect(output).toContain("• Item 3");
    });

    it("should convert ordered lists", () => {
      setMarkdownInput("1. First\n2. Second\n3. Third");
      const output = unicodeOutput.textContent.trim();
      expect(output).toContain("• First");
      expect(output).toContain("• Second");
      expect(output).toContain("• Third");
    });

    it("should convert mixed inline formatting", () => {
      setMarkdownInput("**bold** and *italic* and `code`");
      expect(unicodeOutput.textContent.trim()).toBe("𝗯𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤 and 𝚌𝚘𝚍𝚎");
    });

    it("should handle plain text", () => {
      setMarkdownInput("Just plain text");
      expect(unicodeOutput.textContent.trim()).toBe("Just plain text");
    });

    it("should handle special characters in bold", () => {
      setMarkdownInput('**"quoted" text**');
      expect(unicodeOutput.textContent.trim()).toBe('𝗾𝘂𝗼𝘁𝗲𝗱 𝘁𝗲𝘅𝘁');
    });

    it("should handle numbers in code", () => {
      setMarkdownInput("`123 + 456 = 579`");
      expect(unicodeOutput.textContent.trim()).toBe("𝟷𝟸𝟹 + 𝟺𝟻𝟼 = 𝟻𝟽𝟿");
    });

    it("should handle complex nested markdown", () => {
      setMarkdownInput(`# Title

This is **bold** and this is *italic*.

> A quote with **bold** inside

\`\`\`
code block
\`\`\`

- List item with **bold**
- List item with *italic*
- List item with \`code\`

[A link](https://example.com)
`);
      const output = unicodeOutput.textContent;
      expect(output).toContain("𝗧𝗶𝘁𝗹𝗲");
      expect(output).toContain("𝗯𝗼𝗹𝗱");
      expect(output).toContain("𝘪𝘵𝘢𝘭𝘪𝘤");
      expect(output).toContain("𝚌𝚘𝚍𝚎");
      expect(output).toContain("• List item");
      expect(output).toContain("A link (https://example.com)");
    });

    it("should return empty string for empty input", () => {
      setMarkdownInput("");
      expect(unicodeOutput.textContent.trim()).toBe("");
    });

    it("should copy formatted output to clipboard", async () => {
      setMarkdownInput("**test content**");
      copyButtonMarkdown.click();
      expect(await window.navigator.clipboard.readText()).toBe("𝘁𝗲𝘀𝘁 𝗰𝗼𝗻𝘁𝗲𝗻𝘁\n");
      expect(copyButtonMarkdown.textContent).toBe("Copied!");
      expect(copyButtonMarkdown.classList.contains("btn-success")).toBe(true);
    });
  });

  // ============================================================================
  // Unicode to Markdown Conversion Tests
  // ============================================================================

  describe("Unicode to Markdown", () => {
    it("should convert bullets to list items", () => {
      setUnicodeInput("• Item 1\n• Item 2\n• Item 3");
      expect(markdownOutput.textContent.trim()).toBe("- Item 1\n- Item 2\n- Item 3");
    });

    it("should convert multi-line monospace to fenced code", () => {
      setUnicodeInput("𝚏𝚞𝚗𝚌𝚝𝚒𝚘𝚗 𝚑𝚎𝚕𝚕𝚘() {\n  𝚛𝚎𝚝𝚞𝚛𝚗 \"𝚠𝚘𝚛𝚕𝚍\";\n}");
      const output = markdownOutput.textContent.trim();
      expect(output).toContain("```");
      expect(output).toContain("function hello()");
      expect(output).toContain('return "world"');
    });

    it("should convert bold unicode to markdown", () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱 𝘁𝗲𝘅𝘁");
      expect(markdownOutput.textContent.trim()).toBe("**bold text**");
    });

    it("should convert italic unicode to markdown", () => {
      setUnicodeInput("𝘪𝘵𝘢𝘭𝘪𝘤 𝘵𝘦𝘹𝘵");
      expect(markdownOutput.textContent.trim()).toBe("*italic text*");
    });

    it("should convert monospace unicode to markdown", () => {
      setUnicodeInput("𝚌𝚘𝚍𝚎 𝚝𝚎𝚡𝚝");
      expect(markdownOutput.textContent.trim()).toBe("`code text`");
    });

    it("should convert monospace with digits", () => {
      setUnicodeInput("𝟷𝟸𝟹 + 𝟺𝟻𝟼");
      expect(markdownOutput.textContent.trim()).toBe("`123 + 456`");
    });

    it("should handle mixed bold and plain text", () => {
      setUnicodeInput("This is 𝗯𝗼𝗹𝗱 text");
      expect(markdownOutput.textContent.trim()).toBe("This is **bold** text");
    });

    it("should handle mixed italic and plain text", () => {
      setUnicodeInput("This is 𝘪𝘵𝘢𝘭𝘪𝘤 text");
      expect(markdownOutput.textContent.trim()).toBe("This is *italic* text");
    });

    it("should handle mixed code and plain text", () => {
      setUnicodeInput("This is 𝚌𝚘𝚍𝚎 text");
      expect(markdownOutput.textContent.trim()).toBe("This is `code` text");
    });

    it("should handle multiple styled segments", () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤 and 𝚌𝚘𝚍𝚎");
      expect(markdownOutput.textContent.trim()).toBe("**bold** and *italic* and `code`");
    });

    it("should preserve plain text", () => {
      setUnicodeInput("Just plain text");
      expect(markdownOutput.textContent.trim()).toBe("Just plain text");
    });

    it("should handle uppercase letters in bold", () => {
      setUnicodeInput("𝗛𝗲𝗹𝗹𝗼 𝗪𝗼𝗿𝗹𝗱");
      expect(markdownOutput.textContent.trim()).toBe("**Hello World**");
    });

    it("should handle uppercase letters in italic", () => {
      setUnicodeInput("𝘏𝘦𝘭𝘭𝘰 𝘞𝘰𝘳𝘭𝘥");
      expect(markdownOutput.textContent.trim()).toBe("*Hello World*");
    });

    it("should handle uppercase letters in monospace", () => {
      setUnicodeInput("𝙷𝚎𝚕𝚕𝚘 𝚆𝚘𝚛𝚕𝚍");
      expect(markdownOutput.textContent.trim()).toBe("`Hello World`");
    });

    it("should handle newlines and preserve structure", () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱\n\n𝘪𝘵𝘢𝘭𝘪𝘤\n\n𝚌𝚘𝚍𝚎");
      expect(markdownOutput.textContent.trim()).toBe("**bold**\n\n*italic*\n\n`code`");
    });

    it("should handle complex mixed content", () => {
      setUnicodeInput("Normal text with 𝗯𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤 and 𝚌𝚘𝚍𝚎 parts.");
      expect(markdownOutput.textContent.trim()).toBe("Normal text with **bold** and *italic* and `code` parts.");
    });

    it("should handle consecutive styled segments", () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱𝘪𝘵𝘢𝘭𝘪𝘤");
      expect(markdownOutput.textContent.trim()).toBe("**bold***italic*");
    });

    it("should return empty string for empty input", () => {
      setUnicodeInput("");
      expect(markdownOutput.textContent.trim()).toBe("");
    });

    it("should handle special characters that aren't styled", () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱 with !@#$% symbols");
      expect(markdownOutput.textContent.trim()).toBe("**bold** with !@#$% symbols");
    });

    it("should copy formatted output to clipboard", async () => {
      setUnicodeInput("𝗯𝗼𝗹𝗱 𝘁𝗲𝘅𝘁");
      copyButtonUnicode.click();
      expect(await window.navigator.clipboard.readText()).toBe("**bold text**\n");
      expect(copyButtonUnicode.textContent).toBe("Copied!");
      expect(copyButtonUnicode.classList.contains("btn-success")).toBe(true);
    });
  });

  // ============================================================================
  // Round-trip Conversion Tests
  // ============================================================================

  describe("Round-trip conversions", () => {
    it("should handle bold round-trip", () => {
      setMarkdownInput("**bold text**");
      const unicodeResult = unicodeOutput.textContent.trim();
      setUnicodeInput(unicodeResult);
      expect(markdownOutput.textContent.trim()).toBe("**bold text**");
    });

    it("should handle italic round-trip", () => {
      setMarkdownInput("*italic text*");
      const unicodeResult = unicodeOutput.textContent.trim();
      setUnicodeInput(unicodeResult);
      expect(markdownOutput.textContent.trim()).toBe("*italic text*");
    });

    it("should handle code round-trip", () => {
      setMarkdownInput("`code text`");
      const unicodeResult = unicodeOutput.textContent.trim();
      setUnicodeInput(unicodeResult);
      expect(markdownOutput.textContent.trim()).toBe("`code text`");
    });

    it("should handle mixed formatting round-trip", () => {
      setMarkdownInput("**bold** and *italic* and `code`");
      const unicodeResult = unicodeOutput.textContent.trim();
      setUnicodeInput(unicodeResult);
      expect(markdownOutput.textContent.trim()).toBe("**bold** and *italic* and `code`");
    });
  });
});
