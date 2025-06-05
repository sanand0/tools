// Unicode character mapping functions
const styles = {
  // Convert to sans-serif bold (for headings and bold text)
  heading: (s) =>
    s
      .split("")
      .map((c) => {
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) + 120211);
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) + 120205);
        return c;
      })
      .join(""),

  // Same as heading - sans-serif bold
  bold: (s) =>
    s
      .split("")
      .map((c) => {
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) + 120211);
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) + 120205);
        return c;
      })
      .join(""),

  // Convert to sans-serif italic (for italic text and blockquotes)
  italic: (s) =>
    s
      .split("")
      .map((c) => {
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) + 120263);
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) + 120257);
        return c;
      })
      .join(""),

  // Same as italic - sans-serif italic
  blockquote: (s) =>
    s
      .split("")
      .map((c) => {
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) + 120263);
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) + 120257);
        return c;
      })
      .join(""),

  // Convert to monospace (for code)
  code: (s) =>
    s
      .split("")
      .map((c) => {
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) + 120367);
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) + 120361);
        if (c >= "0" && c <= "9") return String.fromCodePoint(c.charCodeAt(0) + 120764);
        return c;
      })
      .join(""),

  link: (text, url) => (text === url ? text : `${text} (${url})`),
  image: (alt) => alt,
};

/**
 * Show error message to the user
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
 * Copy the formatted output to clipboard
 */
const copyToClipboard = () => {
  const outputText = document.getElementById("output").innerText;

  if (!outputText.trim()) {
    showError("Nothing to copy");
    return;
  }

  try {
    navigator.clipboard.writeText(outputText).then(() => {
      const copyButton = document.getElementById("copy-button");
      const originalText = copyButton.textContent;

      copyButton.textContent = "Copied!";
      copyButton.classList.remove("btn-light");
      copyButton.classList.add("btn-success");

      setTimeout(() => {
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard me-1" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
              </svg>
              Copy to Clipboard`;
        copyButton.classList.remove("btn-success");
        copyButton.classList.add("btn-light");
      }, 2000);
    });
  } catch (error) {
    showError("Failed to copy: " + error.message);
  }
};

/**
 * Convert Markdown to specially formatted text using unicode styles
 */
const convertMarkdownToUnicode = (markdown) => {
  if (!markdown.trim()) return "";

  try {
    // Configure marked renderer
    const renderer = new marked.Renderer();

    // Handle headings
    renderer.heading = (text, level) => styles.heading(text) + "\n\n";

    // Handle bold text
    renderer.strong = (text) => styles.bold(text);

    // Handle italic text
    renderer.em = (text) => styles.italic(text);

    // Handle blockquotes
    renderer.blockquote = (text) => styles.blockquote(text.replace(/<p>/g, "").replace(/<\/p>/g, "")) + "\n\n";

    // Handle code
    renderer.code = (code) => styles.code(code) + "\n\n";
    renderer.codespan = (code) => styles.code(code);

    // Handle links
    renderer.link = (href, title, text) => styles.link(text, href);

    // Handle images
    renderer.image = (href, title, alt) => styles.image(alt || "Image");

    // Handle paragraphs
    renderer.paragraph = (text) => text + "\n\n";

    // Handle lists
    renderer.list = (body, ordered) => body + "\n";
    renderer.listitem = (text) => `• ${text}\n`;

    const options = {
      renderer: renderer,
      gfm: true,
      breaks: true,
    };

    // Convert markdown to formatted text
    return marked.parse(markdown, options);
  } catch (error) {
    showError(error.message);
    return "Failed to parse Markdown.";
  }
};

/**
 * Update the output when input changes
 */
const updateOutput = () => {
  hideError();
  const markdown = document.getElementById("markdown-input").value;
  const output = convertMarkdownToUnicode(markdown);

  // Display formatted output
  document.getElementById("output").replaceChildren();
  document
    .getElementById("output")
    .insertAdjacentHTML(
      "beforeend",
      `<div class="m-0" style="white-space: pre-wrap; word-break: break-word;">${DOMPurify.sanitize(output)}</div>`,
    );
};

// Setup event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("markdown-input").addEventListener("input", updateOutput);
  document.getElementById("copy-button").addEventListener("click", copyToClipboard);

  // Initialize with example content
  const exampleMarkdown = `# Heading 1

This is **bold text** and this is *italic text*.

> This is a blockquote

\`\`\`
// This is fenced code
function hello() {
  return "world";
}
\`\`\`

This is \`inline code\`

[Link text](https://example.com)

![Alt text for image](image.jpg)

- List item 1
- List item 2
`;
  document.getElementById("markdown-input").value = exampleMarkdown;
  updateOutput();
});
