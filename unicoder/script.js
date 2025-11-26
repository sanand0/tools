import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const $ = (selector, el = document) => el.querySelector(selector);
saveform("#unicoder-form");

const raw = (s) => new DOMParser().parseFromString(s, "text/html").documentElement.textContent;

const range = (fromChar, toChar, offset) => ({
  from: fromChar.codePointAt(0),
  to: toChar.codePointAt(0),
  offset,
});

const styleRanges = {
  bold: [range("A", "Z", 120211), range("a", "z", 120205)],
  italic: [range("A", "Z", 120263), range("a", "z", 120257)],
  code: [range("A", "Z", 120367), range("a", "z", 120361), range("0", "9", 120764)],
};

const codeCharPattern = /[\u{1D670}-\u{1D7FF}]/u;

const encodeWithRanges = (text, ranges) =>
  [...text]
    .map((char) => {
      const code = char.codePointAt(0);
      for (const { from, to, offset } of ranges) {
        if (code >= from && code <= to) return String.fromCodePoint(code + offset);
      }
      return char;
    })
    .join("");

const decodeChar = (char) => {
  const code = char.codePointAt(0);
  for (const [style, ranges] of Object.entries(styleRanges)) {
    for (const { from, to, offset } of ranges) {
      if (code >= from + offset && code <= to + offset) {
        return { style, char: String.fromCodePoint(code - offset) };
      }
    }
  }
  return { style: "plain", char };
};

const styles = {
  heading: (s) => encodeWithRanges(s, styleRanges.bold),
  bold: (s) => encodeWithRanges(s, styleRanges.bold),
  italic: (s) => encodeWithRanges(s, styleRanges.italic),
  blockquote: (s) => encodeWithRanges(s, styleRanges.italic),
  code: (s) => encodeWithRanges(s, styleRanges.code),
  link: (text, url) => (text === url ? text : `${text} (${url})`),
  image: (alt) => alt,
};

const renderText = (targetId, content) => {
  const target = $(targetId);
  target.replaceChildren();
  target.insertAdjacentHTML(
    "beforeend",
    /* html */ `<div class="m-0" style="white-space: pre-wrap; word-break: break-word;">${content}</div>`,
  );
};

const showError = (message) => {
  const errorContainer = $("#error-container");
  errorContainer.textContent = `Error: ${message}`;
  errorContainer.classList.remove("d-none");
};

const hideError = () => {
  $("#error-container").classList.add("d-none");
};

const copyFrom = async (sourceId, buttonId) => {
  hideError();
  const content = $(sourceId).innerText;
  if (!content.trim()) {
    showError("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(content);
    const button = $(buttonId);
    button.textContent = "Copied!";
    button.classList.remove("btn-light");
    button.classList.add("btn-success");
    setTimeout(() => {
      button.innerHTML = /* html */ `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard me-1" viewBox="0 0 16 16">
          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
        </svg>Copy`;
      button.classList.remove("btn-success");
      button.classList.add("btn-light");
    }, 2000);
  } catch (error) {
    showError(`Failed to copy: ${error.message}`);
  }
};

const convertMarkdownToUnicode = (markdown) => {
  if (!markdown.trim()) return "";

  try {
    const renderer = new marked.Renderer();

    renderer.heading = (text) => `${styles.heading(raw(text))}\n\n`;
    renderer.strong = (text) => styles.bold(raw(text));
    renderer.em = (text) => styles.italic(raw(text));
    renderer.blockquote = (text) => `${styles.blockquote(raw(text).replace(/<p>/g, "").replace(/<\/p>/g, ""))}\n`;
    renderer.code = (code) => `${styles.code(raw(code))}\n\n`;
    renderer.codespan = (code) => styles.code(raw(code));
    renderer.link = (href, title, text) => styles.link(raw(text), href);
    renderer.image = (href, title, alt) => styles.image(raw(alt) || "Image");
    renderer.paragraph = (text) => `${raw(text)}\n\n`;
    renderer.list = (body) => `${body}\n`;
    renderer.listitem = (text) => `• ${raw(text)}\n`;

    return marked.parse(markdown, { renderer, gfm: true, breaks: true });
  } catch (error) {
    showError(error.message);
    return "Failed to parse Markdown.";
  }
};

const decodeSegments = (text) => {
  const segments = [];
  let current = { style: null, text: "" };

  const push = () => {
    if (current.text) segments.push(current);
  };

  for (const char of text) {
    const detected = decodeChar(char);
    if (current.style === detected.style) {
      current.text += detected.char;
    } else {
      push();
      current = { style: detected.style, text: detected.char };
    }
  }

  push();
  return segments;
};

const wrapSegments = (segments) => {
  const normalized = [];
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.style === "plain" && segments[i + 1] && segments[i + 1].style !== "plain") {
      const trailing = segment.text.match(/^(.*?)([\p{P}\p{S}]+)$/u);
      if (trailing && trailing[2]) {
        if (trailing[1]) normalized.push({ ...segment, text: trailing[1] });
        normalized.push({ ...segments[i + 1], text: trailing[2] + segments[i + 1].text });
        i += 1;
        continue;
      }
    }
    if (segment.style === "plain" && /^[\s\p{P}\p{S}]+$/u.test(segment.text)) {
      const prev = normalized.at(-1);
      const next = segments[i + 1];
      if (prev && prev.style !== "plain") {
        prev.text += segment.text;
        continue;
      }
      if (next && next.style !== "plain") {
        normalized.push({ ...next, text: segment.text + next.text });
        i += 1;
        continue;
      }
    }
    normalized.push({ ...segment });
  }

  const parts = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const { style, text } = normalized[i];
    if (style === "code") {
      let combined = text;
      let j = i + 1;
      while (j < normalized.length) {
        const next = normalized[j];
        if (next.style === "code") {
          combined += next.text;
          j += 1;
          continue;
        }
        if (next.style === "plain" && !next.text.trim()) {
          combined += next.text;
          j += 1;
          continue;
        }
        break;
      }
      parts.push(`\`${combined}\``);
      i = j - 1;
      continue;
    }
    if (style === "bold" || style === "italic") {
      let combined = text;
      let j = i + 1;
      while (j < normalized.length) {
        const next = normalized[j];
        if (next.style === style) {
          combined += next.text;
          j += 1;
          continue;
        }
        if (next.style === "plain" && /^[\s\p{P}\p{S}]+$/u.test(next.text)) {
          combined += next.text;
          j += 1;
          continue;
        }
        break;
      }
      parts.push(style === "bold" ? `**${combined}**` : `_${combined}_`);
      i = j - 1;
      continue;
    }
    parts.push(text);
  }
  return parts.join("");
};

const decodePlain = (text) => decodeSegments(text).map(({ text: value }) => value).join("");

const isStyleLine = (line, style, allowedPlain = /[^\S\r\n]/u) => {
  let hasTarget = false;
  for (const char of line) {
    if (!char.trim()) continue;
    const detected = decodeChar(char).style;
    if (detected === style) {
      hasTarget = true;
      continue;
    }
    if (allowedPlain && allowedPlain.test(char)) continue;
    return false;
  }
  return hasTarget;
};

const isPureStyleLine = (line, style) => isStyleLine(line, style, null);

const codeLineInfo = (line) => {
  const segments = decodeSegments(line);
  const hasOtherStyle = segments.some(({ style }) => style !== "plain" && style !== "code");
  const hasPlainLetters = segments.some(
    ({ style, text }) => style === "plain" && /[\p{L}\p{N}]/u.test(text),
  );
  const hasCode = codeCharPattern.test(line) || segments.some(({ style }) => style === "code");
  const isPunctuationOnly =
    segments.length === 0 ||
    segments.every(
      ({ style, text }) =>
        style === "plain" && (!text.trim() || /^[\p{P}\p{S}\s]+$/u.test(text)),
    );

  return { hasCode, hasOtherStyle, hasPlainLetters, isPunctuationOnly };
};

const previousLineBlank = (lines, index) => index === 0 || !lines[index - 1].trim();

const convertUnicodeToMarkdown = (unicodeText) => {
  if (!unicodeText.trim()) return "";
  const lines = unicodeText.split("\n");
  const markdownLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      markdownLines.push("");
      continue;
    }

    if (line.startsWith("• ")) {
      markdownLines.push(`- ${wrapSegments(decodeSegments(line.slice(2)))}`);
      continue;
    }

    const trimmed = line.trim();
    const linkMatch = trimmed.match(/^(.*)\s\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      markdownLines.push(`[${wrapSegments(decodeSegments(linkMatch[1]))}](${linkMatch[2]})`);
      continue;
    }

    const codeInfo = codeLineInfo(line);
    if (codeInfo.hasCode && !codeInfo.hasOtherStyle && !codeInfo.hasPlainLetters) {
      const codeLines = [];
      while (index < lines.length) {
        const currentInfo = codeLineInfo(lines[index]);
        if (currentInfo.hasOtherStyle || currentInfo.hasPlainLetters) break;
        if (!currentInfo.hasCode && !currentInfo.isPunctuationOnly) break;
        codeLines.push(decodePlain(lines[index]));
        index += 1;
      }
      while (codeLines.length && !codeLines.at(-1).trim()) {
        codeLines.pop();
      }
      markdownLines.push("```");
      markdownLines.push(...codeLines);
      markdownLines.push("```");
      index -= 1;
      continue;
    }

    if (isStyleLine(trimmed, "bold", /[\s0-9]/u) && previousLineBlank(lines, index)) {
      markdownLines.push(`# ${decodePlain(trimmed)}`);
      continue;
    }

    if (isStyleLine(trimmed, "italic", /[\s\p{P}\p{S}]/u) && previousLineBlank(lines, index)) {
      markdownLines.push(`> ${decodePlain(trimmed)}`);
      continue;
    }

    markdownLines.push(wrapSegments(decodeSegments(line)));
  }

  return markdownLines.join("\n");
};

const updateUnicodeOutput = () => {
  hideError();
  const markdown = $("#markdown-input").value;
  const output = convertMarkdownToUnicode(markdown);
  renderText("#output", output);
};

const updateMarkdownOutput = () => {
  hideError();
  const unicodeText = $("#unicode-input").value;
  const output = convertUnicodeToMarkdown(unicodeText);
  renderText("#markdown-output", output);
};

document.addEventListener("DOMContentLoaded", () => {
  $("#markdown-input").addEventListener("input", updateUnicodeOutput);
  $("#unicode-input").addEventListener("input", updateMarkdownOutput);
  $("#copy-button").addEventListener("click", () => copyFrom("#output", "#copy-button"));
  $("#copy-markdown-button").addEventListener("click", () => copyFrom("#markdown-output", "#copy-markdown-button"));

  const exampleMarkdown = `# Heading 1

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

  $("#markdown-input").value = exampleMarkdown;
  updateUnicodeOutput();

  $("#unicode-input").value = $("#output").innerText.trim();
  updateMarkdownOutput();
});
