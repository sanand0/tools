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

/**
 * Convert Unicode-styled character back to ASCII
 * @param {string} char - Single Unicode character
 * @returns {string} ASCII character or original if not a styled character
 */
const toAscii = (char) => {
  const code = char.codePointAt(0);

  // Sans-serif bold uppercase (A-Z)
  if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCharCode(code - UNICODE_OFFSETS.BOLD_UPPER);
  // Sans-serif bold lowercase (a-z)
  if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCharCode(code - UNICODE_OFFSETS.BOLD_LOWER);

  // Sans-serif italic uppercase (A-Z)
  if (code >= 0x1d608 && code <= 0x1d621) return String.fromCharCode(code - UNICODE_OFFSETS.ITALIC_UPPER);
  // Sans-serif italic lowercase (a-z)
  if (code >= 0x1d622 && code <= 0x1d63b) return String.fromCharCode(code - UNICODE_OFFSETS.ITALIC_LOWER);

  // Monospace uppercase (A-Z)
  if (code >= 0x1d670 && code <= 0x1d689) return String.fromCharCode(code - UNICODE_OFFSETS.MONO_UPPER);
  // Monospace lowercase (a-z)
  if (code >= 0x1d68a && code <= 0x1d6a3) return String.fromCharCode(code - UNICODE_OFFSETS.MONO_LOWER);
  // Monospace digits (0-9)
  if (code >= 0x1d7f6 && code <= 0x1d7ff) return String.fromCharCode(code - UNICODE_OFFSETS.MONO_DIGIT);

  return char;
};

/**
 * Detect the Unicode style of a character
 * @param {string} char - Single character
 * @returns {string|null} Style name ('bold', 'italic', 'mono') or null
 */
const detectStyle = (char) => {
  const code = char.codePointAt(0);

  // Bold (sans-serif bold)
  if ((code >= 0x1d5d4 && code <= 0x1d5ed) || (code >= 0x1d5ee && code <= 0x1d607)) return "bold";

  // Italic (sans-serif italic)
  if ((code >= 0x1d608 && code <= 0x1d621) || (code >= 0x1d622 && code <= 0x1d63b)) return "italic";

  // Monospace
  if ((code >= 0x1d670 && code <= 0x1d689) || (code >= 0x1d68a && code <= 0x1d6a3) || (code >= 0x1d7f6 && code <= 0x1d7ff)) return "mono";

  return null;
};

/**
 * Convert Unicode text back to ASCII, preserving structure
 * @param {string} text - Unicode-styled text
 * @returns {string} ASCII text
 */
const fromUnicodeStyle = (text) => {
  return text
    .split("")
    .map((char) => toAscii(char))
    .join("");
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
    showError(error.message);
    return "Failed to parse Markdown.";
  }
};

// ============================================================================
// Unicode to Markdown Conversion
// ============================================================================

/**
 * Convert Unicode-styled text back to Markdown
 * @param {string} unicodeText - Unicode-styled input text
 * @returns {string} Markdown output
 */
const convertUnicodeToMarkdown = (unicodeText) => {
  if (!unicodeText.trim()) return "";

  try {
    let result = "";
    let currentStyle = null;
    let currentSegment = "";

    // Process character by character (using for...of to handle surrogate pairs correctly)
    for (const char of unicodeText) {
      const style = detectStyle(char);

      // If style changed, flush the current segment
      if (style !== currentStyle) {
        if (currentSegment) {
          result += formatSegment(currentSegment, currentStyle);
          currentSegment = "";
        }
        currentStyle = style;
      }

      // Add character to current segment (convert to ASCII if styled)
      currentSegment += style ? toAscii(char) : char;
    }

    // Flush remaining segment
    if (currentSegment) {
      result += formatSegment(currentSegment, currentStyle);
    }

    // Post-process: merge segments and convert bullets to lists
    return convertBulletsToLists(mergeStyledSegments(result));
  } catch (error) {
    showError(error.message);
    return "Failed to convert Unicode text.";
  }
};

/**
 * Format a text segment with appropriate Markdown syntax
 * @param {string} text - Text segment
 * @param {string|null} style - Style type ('bold', 'italic', 'mono', or null)
 * @returns {string} Formatted text
 */
const formatSegment = (text, style) => {
  if (!style) return text;

  const formatters = {
    bold: (t) => `**${t}**`,
    italic: (t) => `*${t}*`,
    mono: (t) => {
      // Multi-line code becomes fenced, single-line stays inline
      const lines = t.split("\n").filter((l) => l.trim());
      return lines.length >= 2 ? `\`\`\`\n${t}\n\`\`\`` : `\`${t}\``;
    },
  };

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
 * Show error message
 */
const showError = (message) => {
  const errorContainer = document.getElementById("error-container");
  errorContainer.textContent = `Error: ${message}`;
  errorContainer.classList.remove("d-none");
};

/**
 * Hide error message
 */
const hideError = () => {
  document.getElementById("error-container").classList.add("d-none");
};

/**
 * Copy text to clipboard with button feedback
 */
const copyToClipboard = (text, button) => {
  if (!text.trim()) return showError("Nothing to copy");

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
    .catch((error) => showError("Failed to copy: " + error.message));
};

// ============================================================================
// Event Handlers
// ============================================================================

const renderOutput = (outputId, content) => {
  const output = document.getElementById(outputId);
  output.replaceChildren();
  output.insertAdjacentHTML("beforeend", `<div class="m-0" style="white-space: pre-wrap; word-break: break-word;">${content}</div>`);
};

const updateMarkdownOutput = () => {
  hideError();
  renderOutput("unicode-output", convertMarkdownToUnicode(document.getElementById("markdown-input").value));
};

const updateUnicodeOutput = () => {
  hideError();
  renderOutput("markdown-output", convertUnicodeToMarkdown(document.getElementById("unicode-input").value));
};

const handleCopy = (outputId, buttonId) => () => {
  copyToClipboard(document.getElementById(outputId).innerText, document.getElementById(buttonId));
};

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
  module.exports = {
    convertMarkdownToUnicode,
    convertUnicodeToMarkdown,
    toBold,
    toItalic,
    toMonospace,
    toAscii,
    detectStyle,
    fromUnicodeStyle,
  };
}
