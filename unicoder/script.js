import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
saveform("#unicoder-form");

const raw = (s) => new DOMParser().parseFromString(s, "text/html").documentElement.textContent;

// ============================================================================
// Unicode Character Mapping Constants
// ============================================================================

// Offsets for Unicode Mathematical Alphanumeric Symbols
const UNICODE_OFFSETS = {
  // Sans-serif bold (for headings and bold)
  BOLD_UPPER: 120211, // A-Z
  BOLD_LOWER: 120205, // a-z

  // Sans-serif italic (for italic and blockquotes)
  ITALIC_UPPER: 120263, // A-Z
  ITALIC_LOWER: 120257, // a-z

  // Monospace (for code)
  MONO_UPPER: 120367, // A-Z
  MONO_LOWER: 120361, // a-z
  MONO_DIGIT: 120774, // 0-9
};

// ============================================================================
// Forward Conversion: ASCII → Unicode
// ============================================================================

/**
 * Convert ASCII text to Unicode style
 * @param {string} text - Input text
 * @param {Object} offsets - Unicode offsets for uppercase, lowercase, and optionally digits
 * @returns {string} Unicode-styled text
 */
const toUnicodeStyle = (text, { upper, lower, digit = null }) => {
  return text
    .split("")
    .map((char) => {
      if (char >= "A" && char <= "Z") {
        return String.fromCodePoint(char.charCodeAt(0) + upper);
      }
      if (char >= "a" && char <= "z") {
        return String.fromCodePoint(char.charCodeAt(0) + lower);
      }
      if (digit !== null && char >= "0" && char <= "9") {
        return String.fromCodePoint(char.charCodeAt(0) + digit);
      }
      return char;
    })
    .join("");
};

// Style-specific converters
const toBold = (text) => toUnicodeStyle(text, { upper: UNICODE_OFFSETS.BOLD_UPPER, lower: UNICODE_OFFSETS.BOLD_LOWER });
const toItalic = (text) => toUnicodeStyle(text, { upper: UNICODE_OFFSETS.ITALIC_UPPER, lower: UNICODE_OFFSETS.ITALIC_LOWER });
const toMonospace = (text) =>
  toUnicodeStyle(text, { upper: UNICODE_OFFSETS.MONO_UPPER, lower: UNICODE_OFFSETS.MONO_LOWER, digit: UNICODE_OFFSETS.MONO_DIGIT });

// ============================================================================
// Reverse Conversion: Unicode → ASCII
// ============================================================================

// Character range mappings for detection and conversion
const CHAR_RANGES = [
  { start: 0x1d5d4, end: 0x1d5ed, offset: UNICODE_OFFSETS.BOLD_UPPER, style: "bold" },
  { start: 0x1d5ee, end: 0x1d607, offset: UNICODE_OFFSETS.BOLD_LOWER, style: "bold" },
  { start: 0x1d608, end: 0x1d621, offset: UNICODE_OFFSETS.ITALIC_UPPER, style: "italic" },
  { start: 0x1d622, end: 0x1d63b, offset: UNICODE_OFFSETS.ITALIC_LOWER, style: "italic" },
  { start: 0x1d670, end: 0x1d689, offset: UNICODE_OFFSETS.MONO_UPPER, style: "mono" },
  { start: 0x1d68a, end: 0x1d6a3, offset: UNICODE_OFFSETS.MONO_LOWER, style: "mono" },
  { start: 0x1d7f6, end: 0x1d7ff, offset: UNICODE_OFFSETS.MONO_DIGIT, style: "mono" },
];

/**
 * Convert Unicode-styled character back to ASCII
 */
const toAscii = (char) => {
  const code = char.codePointAt(0);
  const range = CHAR_RANGES.find((r) => code >= r.start && code <= r.end);
  return range ? String.fromCharCode(code - range.offset) : char;
};

/**
 * Detect the Unicode style of a character
 */
const detectStyle = (char) => {
  const code = char.codePointAt(0);
  const range = CHAR_RANGES.find((r) => code >= r.start && code <= r.end);
  return range?.style ?? null;
};


// ============================================================================
// Markdown to Unicode Conversion
// ============================================================================

/**
 * Convert Markdown to Unicode-styled text
 * @param {string} markdown - Input Markdown text
 * @returns {string} Unicode-styled output
 */
const convertMarkdownToUnicode = (markdown) => {
  if (!markdown.trim()) return "";

  try {
    const renderer = new marked.Renderer();

    // Headings → bold
    renderer.heading = (text) => toBold(raw(text)) + "\n\n";

    // Bold text → bold
    renderer.strong = (text) => toBold(raw(text));

    // Italic text → italic
    renderer.em = (text) => toItalic(raw(text));

    // Blockquotes → italic
    renderer.blockquote = (text) => toItalic(raw(text).replace(/<p>/g, "").replace(/<\/p>/g, "")) + "\n\n";

    // Code blocks → monospace
    renderer.code = (code) => toMonospace(raw(code)) + "\n\n";
    renderer.codespan = (code) => toMonospace(raw(code));

    // Links → text (url)
    renderer.link = (href, title, text) => {
      const linkText = raw(text);
      return linkText === href ? linkText : `${linkText} (${href})`;
    };

    // Images → alt text
    renderer.image = (href, title, alt) => raw(alt) || "Image";

    // Paragraphs
    renderer.paragraph = (text) => raw(text) + "\n\n";

    // Lists
    renderer.list = (body) => body + "\n";
    renderer.listitem = (text) => `• ${raw(text)}\n`;

    const options = {
      renderer: renderer,
      gfm: true,
      breaks: true,
    };

    return marked.parse(markdown, options);
  } catch (error) {
    setError(error.message);
    return "Failed to parse Markdown.";
  }
};

// ============================================================================
// Unicode to Markdown Conversion
// ============================================================================

/**
 * Convert Unicode-styled text back to Markdown
 */
const convertUnicodeToMarkdown = (unicodeText) => {
  if (!unicodeText.trim()) return "";

  try {
    // Pre-process: detect multi-line code blocks (lines with monospace characters)
    const lines = unicodeText.split("\n");
    const processedLines = [];
    let codeBlockLines = [];
    let inCodeBlock = false;

    for (const line of lines) {
      const monoChars = [...line].filter((c) => detectStyle(c) === "mono").length;
      const totalChars = [...line].filter((c) => c.trim()).length;
      const isCodeLine = monoChars > 0 && totalChars > 0 && monoChars / totalChars > 0.3;
      const isShortLine = totalChars <= 3; // Lines like }, ], etc.

      if (isCodeLine || (inCodeBlock && isShortLine)) {
        codeBlockLines.push(line);
        inCodeBlock = true;
      } else {
        if (inCodeBlock && codeBlockLines.length >= 2) {
          processedLines.push(convertCodeBlock(codeBlockLines.join("\n")));
          codeBlockLines = [];
        } else if (codeBlockLines.length > 0) {
          processedLines.push(...codeBlockLines);
          codeBlockLines = [];
        }
        processedLines.push(line);
        inCodeBlock = false;
      }
    }

    // Handle remaining code block
    if (codeBlockLines.length >= 2) {
      processedLines.push(convertCodeBlock(codeBlockLines.join("\n")));
    } else if (codeBlockLines.length > 0) {
      processedLines.push(...codeBlockLines);
    }

    // Process non-code-block lines normally
    const result = processedLines
      .map((line, i) => {
        if (typeof line === "object") return line.markdown; // Already processed code block
        return convertLine(line);
      })
      .join("\n");

    return convertBulletsToLists(result);
  } catch (error) {
    setError(error.message);
    return "Failed to convert Unicode text.";
  }
};

/**
 * Convert a code block (multiple lines of code)
 */
const convertCodeBlock = (text) => ({
  markdown: "```\n" + [...text].map((c) => (detectStyle(c) === "mono" ? toAscii(c) : c)).join("") + "\n```",
});

/**
 * Convert a single line of text
 */
const convertLine = (text) => {
  let result = "";
  let currentStyle = null;
  let currentSegment = "";

  for (const char of text) {
    const style = detectStyle(char);

    if (style !== currentStyle) {
      if (currentSegment) {
        result += formatSegment(currentSegment, currentStyle);
        currentSegment = "";
      }
      currentStyle = style;
    }

    currentSegment += style ? toAscii(char) : char;
  }

  if (currentSegment) {
    result += formatSegment(currentSegment, currentStyle);
  }

  return mergeStyledSegments(result);
};

/**
 * Format a text segment with appropriate Markdown syntax
 */
const formatSegment = (text, style) => {
  if (!style) return text;
  const formatters = { bold: (t) => `**${t}**`, italic: (t) => `*${t}*`, mono: (t) => `\`${t}\`` };
  return formatters[style]?.(text) ?? text;
};

/**
 * Merge consecutive styled segments separated by spaces
 * For example: "**Hello** **World**" becomes "**Hello World**"
 */
const mergeStyledSegments = (markdown) => {
  const patterns = [
    [/\*\*([^*]+)\*\* \*\*([^*]+)\*\*/g, "**$1 $2**"], // Bold
    [/\*([^*]+)\* \*([^*]+)\*/g, "*$1 $2*"], // Italic
    [/`([^`]+)` `([^`]+)`/g, "`$1 $2`"], // Code
  ];

  let prev;
  do {
    prev = markdown;
    patterns.forEach(([pattern, replacement]) => {
      markdown = markdown.replace(pattern, replacement);
    });
  } while (markdown !== prev);

  return markdown;
};

/**
 * Convert bullet points (•) to Markdown list items (-)
 */
const convertBulletsToLists = (markdown) => markdown.replace(/^• /gm, "- ");

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Show or hide error message
 */
const setError = (message = null) => {
  const el = document.getElementById("error-container");
  if (message) {
    el.textContent = `Error: ${message}`;
    el.classList.remove("d-none");
  } else {
    el.classList.add("d-none");
  }
};

/**
 * Copy text to clipboard with button feedback
 */
const copyToClipboard = (text, button) => {
  if (!text.trim()) return setError("Nothing to copy");

  const { innerHTML, className } = button;

  navigator.clipboard
    .writeText(text)
    .then(() => {
      button.textContent = "Copied!";
      button.className = button.className.replace("btn-light", "btn-success");

      setTimeout(() => {
        button.innerHTML = innerHTML;
        button.className = className;
      }, 2000);
    })
    .catch((error) => setError("Failed to copy: " + error.message));
};

// ============================================================================
// Event Handlers
// ============================================================================

const renderOutput = (id, content) => {
  const el = document.getElementById(id);
  el.replaceChildren();
  el.insertAdjacentHTML("beforeend", `<div class="m-0" style="white-space: pre-wrap; word-break: break-word;">${content}</div>`);
};

const updateMarkdownOutput = () => {
  setError();
  renderOutput("unicode-output", convertMarkdownToUnicode(document.getElementById("markdown-input").value));
};

const updateUnicodeOutput = () => {
  setError();
  renderOutput("markdown-output", convertUnicodeToMarkdown(document.getElementById("unicode-input").value));
};

const handleCopy = (outputId, buttonId) => () =>
  copyToClipboard(document.getElementById(outputId).innerText, document.getElementById(buttonId));

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Markdown to Unicode section
  document.getElementById("markdown-input").addEventListener("input", updateMarkdownOutput);
  document.getElementById("copy-button-markdown").addEventListener("click", handleCopy("unicode-output", "copy-button-markdown"));

  // Unicode to Markdown section
  document.getElementById("unicode-input").addEventListener("input", updateUnicodeOutput);
  document.getElementById("copy-button-unicode").addEventListener("click", handleCopy("markdown-output", "copy-button-unicode"));

  // Initialize with example
  document.getElementById("markdown-input").value = `# Heading 1

This is **"bold" text** and this is *"italic" text*.

> This is a blockquote

\`\`\`
// This is fenced code
function hello() {
  return "world";
}
\`\`\`

This is \`"inline" code\`

[Link text](https://example.com)

![Alt text for image](image.jpg)

- List item 1
- List item 2
`;
  updateMarkdownOutput();
});

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = { convertMarkdownToUnicode, convertUnicodeToMarkdown, toBold, toItalic, toMonospace, toAscii, detectStyle };
}
