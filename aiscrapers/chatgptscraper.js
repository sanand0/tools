(function (root) {
  const $ = (selector, el = root.document) => el.querySelector(selector);
  const nodeTypes = root.Node || { TEXT_NODE: 3, ELEMENT_NODE: 1 };

  function formatLocalIso(date) {
    const pad = (value) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
      date.getMinutes(),
    )}:${pad(date.getSeconds())}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
  }

  function yamlEscape(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ");
  }

  const cleanText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const cleanTitle = (value, product = "ChatGPT") => {
    const title = cleanText(value).replace(new RegExp(`\\s+-\\s+${product}$`, "i"), "");
    return title && !new RegExp(`^(?:${product}|${product} Conversation|New chat)$`, "i").test(title) ? title : "";
  };
  const isHidden = (node) => node.hidden || node.closest?.("[hidden], .sr-only, [aria-hidden='true']");
  const isBlockTag = (tag) =>
    /^(p|div|section|article|ul|ol|li|table|thead|tbody|tr|blockquote|pre|hr|h[1-6])$/.test(tag);

  function textWithBreaks(node) {
    if (!node) return "";
    if (node.nodeType === nodeTypes.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== nodeTypes.ELEMENT_NODE) return "";
    const tag = node.tagName?.toLowerCase();
    if (tag === "br") return "\n";
    return Array.from(node.childNodes).map(textWithBreaks).join("");
  }

  function codeTextForPre(node) {
    const codeNode =
      node.querySelector("pre code") || node.querySelector(":scope > code") || node.querySelector("code");
    return codeNode ? textWithBreaks(codeNode) : node.innerText || node.textContent || "";
  }

  function fenceCode(code, language = "") {
    const fence = code.includes("```") ? "````" : "```";
    return `\n${fence}${language.toLowerCase()}\n${code.replace(/\n+$/g, "")}\n${fence}\n\n`;
  }

  function parseTable(node) {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
      Array.from(row.children)
        .filter((child) => ["td", "th"].includes(child.tagName?.toLowerCase()))
        .map((cell) => parseChildren(cell).replace(/\s+/g, " ").trim()),
    );
    if (!rows.length) return "";
    const columnCount = Math.max(...rows.map((row) => row.length), 0);
    if (!columnCount) return "";
    const padded = rows.map((row) => [...row, ...Array(columnCount - row.length).fill("")]);
    const [header, ...body] = padded;
    const renderRow = (cells) => `| ${cells.join(" | ")} |`;
    return `${renderRow(header)}\n${renderRow(Array(columnCount).fill("---"))}${
      body.length ? `\n${body.map(renderRow).join("\n")}` : ""
    }\n\n`;
  }

  function parseListItem(node) {
    const parent = node.parentElement;
    const marker =
      parent?.tagName?.toLowerCase() === "ol" ? `${Array.from(parent.children).indexOf(node) + 1}. ` : "* ";
    return `${marker}${parseChildren(node).trim()}\n`;
  }

  function parseLink(node) {
    const href = node.getAttribute("href") || "#";
    const directText = Array.from(node.children)
      .map((child) => cleanText(child.innerText || child.textContent))
      .filter(Boolean);
    const isCard =
      directText.length > 1 ||
      Array.from(node.parentElement?.children || []).filter((child) => child.tagName === "A").length > 1;
    if (isCard) {
      const [title, ...meta] = directText;
      return `* [${title || href}](${href})${meta.length ? ` - ${meta.join(" - ")}` : ""}\n`;
    }
    const text = parseChildren(node).trim() || href;
    return `[${text}](${href})`;
  }

  function parseNode(node) {
    if (node.nodeType === nodeTypes.TEXT_NODE) return node.textContent;
    if (node.nodeType !== nodeTypes.ELEMENT_NODE || isHidden(node)) return "";
    if (node.dataset?.aiscraperMarkdown) return `\n${node.dataset.aiscraperMarkdown}\n\n`;

    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "svg" || tag === "input") return "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "pre") return fenceCode(codeTextForPre(node));
    if (tag === "code") {
      if (node.closest("pre")) return node.textContent || "";
      return `\`${(node.textContent || "").replace(/\s+/g, " ").trim()}\``;
    }
    if (tag === "table") return parseTable(node);
    if (tag === "strong" || tag === "b") return `**${parseChildren(node)}**`;
    if (tag === "em" || tag === "i") return `*${parseChildren(node)}*`;
    if (tag === "a") {
      return parseLink(node);
    }
    if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${parseChildren(node).trim()}\n\n`;
    if (tag === "li") return parseListItem(node);
    if (tag === "ul" || tag === "ol") return `${parseChildren(node)}\n`;
    if (tag === "blockquote") return `> ${parseChildren(node).trim().replace(/\n/g, "\n> ")}\n\n`;
    if (tag === "button" || tag === "label") {
      if (isControl(node)) return "";
      return parseChildren(node);
    }

    const content = parseChildren(node);
    if (tag === "p") return `${content.trim()}\n\n`;
    return content;
  }

  function parseChildren(node) {
    return Array.from(node.childNodes).reduce((output, child) => {
      let chunk = parseNode(child);
      if (!chunk) return output;
      if (child.nodeType === nodeTypes.TEXT_NODE) {
        chunk = chunk.replace(/\s+/g, " ");
        if (!chunk.trim()) return output.endsWith(" ") || output.endsWith("\n") ? output : `${output} `;
      }
      if (child.nodeType === nodeTypes.ELEMENT_NODE && isBlockTag(child.tagName.toLowerCase())) {
        output = output.replace(/[ \t]+$/g, "");
        if (output && !output.endsWith("\n")) output += "\n\n";
      }
      if (child.nodeType === nodeTypes.ELEMENT_NODE && chunk.startsWith("* [")) output = output.replace(/[ \t]+$/g, "");
      return output + chunk;
    }, "");
  }

  function isControl(node) {
    const text = cleanText(node.innerText || node.textContent || node.getAttribute("aria-label"));
    const testid = node.getAttribute("data-testid") || "";
    return (
      /copy|more actions|sources|rate|regenerate|edit message|read aloud|open tool call list/i.test(text) ||
      /copy-turn-action|collapsible-user-message-toggle/.test(testid)
    );
  }

  const compactToolPayload = (lines) => {
    const text = lines
      .filter((line) => line !== "Copy")
      .join("\n")
      .replace(/(^|\n)\s*Copy\s+/g, "$1")
      .trim();
    return text
      .replace(/^\{\n([A-Za-z_$][\w$]*):\s*\n([\s\S]*)\n\}$/g, "{$1: $2}")
      .replace(/^\{\s+([A-Za-z_$][\w$]*):\s*/g, "{$1: ")
      .replace(/\n\s*\n/g, "\n");
  };

  function formatToolMessage(node) {
    const lines = (node.innerText || node.textContent || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const calledIndex = lines.findIndex((line) => /^Called tool$/i.test(line));
    const requestIndex = lines.findIndex((line) => /^Request$/i.test(line));
    const responseIndex = lines.findIndex((line, index) => index > requestIndex && /^Response$/i.test(line));
    if (calledIndex === -1 || requestIndex === -1) {
      const compact = cleanText(node.textContent);
      const match = compact.match(/^Called tool\s+([\s\S]+?)\s+Request\s+([\s\S]*?)(?:\s+Response\s+([\s\S]+))?$/i);
      if (!match) return "";
      const descriptor = match[1].trim();
      const action = descriptor.endsWith(" Call tool") ? "Call tool" : descriptor.split(/\s+/).pop();
      const tool = descriptor.endsWith(" Call tool")
        ? descriptor.replace(/\s+Call tool$/, "")
        : descriptor.replace(new RegExp(`\\s+${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
      const request = compactToolPayload([match[2]]);
      const response = match[3] ? compactToolPayload([match[3]]) : "";
      return formatToolDetails(tool || "Tool", action || "", request, response);
    }

    const tool = lines[calledIndex + 1] || "Tool";
    const action = lines[calledIndex + 2] && !/^Request$/i.test(lines[calledIndex + 2]) ? lines[calledIndex + 2] : "";
    const request = compactToolPayload(lines.slice(requestIndex + 1, responseIndex === -1 ? undefined : responseIndex));
    const response = responseIndex === -1 ? "" : compactToolPayload(lines.slice(responseIndex + 1));
    return formatToolDetails(tool, action, request, response);
  }

  function formatToolDetails(tool, action, request, response) {
    const actionLabel = /^call tool$/i.test(action) ? "Call Tool" : action;
    const responseFence = response && /^[{[]/.test(response) ? `\n\`\`\`\n${response}\n\`\`\`\n` : `\n${response}\n`;
    return `<details>\n<summary>Called tool: ${tool}${actionLabel ? ` - ${actionLabel}` : ""}</summary>\n\nRequest\n\n\`\`\`\n${request}\n\`\`\`\n${
      response ? `\nResponse\n${responseFence}` : ""
    }\n</details>`;
  }

  function isToolMessageNode(node) {
    const className = String(node.getAttribute?.("class") || node.className || "");
    const text = cleanText(node.innerText || node.textContent);
    return className.includes("tool-message") || (/^Called tool\b/i.test(text) && /\bRequest\b/i.test(text));
  }

  const topLevelToolMessages = (node) => {
    const candidates = Array.from(node.querySelectorAll("*")).filter(isToolMessageNode);
    return candidates.filter(
      (toolNode) => !candidates.some((ancestor) => ancestor !== toolNode && ancestor.contains(toolNode)),
    );
  };

  function transformToolMessages(rootNode, sourceNode) {
    const sourceTools = topLevelToolMessages(sourceNode);
    topLevelToolMessages(rootNode).forEach((node, index) => {
      const markdown = formatToolMessage(sourceTools[index] || node);
      if (!markdown) return;
      const replacement = root.document.createElement("div");
      replacement.dataset.aiscraperMarkdown = markdown;
      node.replaceWith(replacement);
    });
  }

  const isThoughtButton = (node) => /^Thought for /i.test(cleanText(node.innerText || node.textContent));

  function reasoningPanel(doc = root.document) {
    return (
      doc.querySelector('[data-testid="screen-threadFlyOut"][aria-label="Reasoning details"]') ||
      doc.querySelector('section[aria-label="Reasoning details"]')
    );
  }

  async function waitForReasoningPanel(doc, win, label) {
    const duration = label.replace(/^Thought for\s+/i, "").trim();
    for (let i = 0; i < 16; i += 1) {
      const panel = reasoningPanel(doc);
      const text = cleanText(panel?.innerText || panel?.textContent);
      if (panel && text && (!duration || text.includes(duration))) return panel;
      await new Promise((resolve) => win.setTimeout(resolve, 250));
    }
    return reasoningPanel(doc);
  }

  function formatThoughtDetails(label, panel) {
    if (!panel) return "";
    const clone = panel.cloneNode(true);
    clone
      .querySelectorAll(
        '[data-testid="bar-search-sources-header"], [data-testid="search-sources-inline-loading-row"], [data-testid="search-sources-loading-skeleton-row"]',
      )
      .forEach((node) => node.remove());
    clone.querySelectorAll("button").forEach((button) => {
      if (/^Close$/i.test(cleanText(button.getAttribute("aria-label") || button.innerText || button.textContent))) {
        button.remove();
      }
    });
    const markdown = parseChildren(clone).trim();
    return markdown ? `<details>\n<summary>${label}</summary>\n\n${markdown}\n\n</details>` : "";
  }

  const isConversationTurn = (node) => /^conversation-turn-\d+/.test(node.getAttribute?.("data-testid") || "");
  const getTurnRoot = (message) => message.closest("section[data-testid^='conversation-turn-']") || message;

  function getTurns(doc = root.document) {
    const roots = Array.from(doc.querySelectorAll("section[data-testid^='conversation-turn-']")).filter(
      isConversationTurn,
    );
    const source = roots.length
      ? roots
      : Array.from(doc.querySelectorAll("[data-message-author-role]")).map(getTurnRoot);
    const seen = new Set();
    return source
      .map((turn) => {
        if (seen.has(turn)) return null;
        seen.add(turn);
        const messages = Array.from(
          turn.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]'),
        );
        const role = messages[0]?.getAttribute("data-message-author-role");
        if (!role) return null;
        return { role: role === "assistant" ? "ChatGPT" : "User", node: turn, messages };
      })
      .filter(Boolean);
  }

  function cloneForExtraction(turn) {
    const clone = turn.cloneNode(true);
    transformToolMessages(clone, turn);
    clone
      .querySelectorAll("nav, menu, form, textarea, [contenteditable='true'], .sr-only, [aria-hidden='true']")
      .forEach((node) => {
        node.remove();
      });
    clone.querySelectorAll("button, label").forEach((node) => {
      if (isControl(node)) node.remove();
    });
    clone.querySelectorAll("*").forEach((node) => {
      const text = cleanText(node.innerText || node.textContent);
      if (/^(?:Looked for available tools)?(?:Called tool)+$/i.test(text)) node.remove();
    });
    return clone;
  }

  function extractTurn(turn) {
    const clone = cloneForExtraction(turn.node);
    return parseChildren(clone).trim();
  }

  function extractConversation(doc = root.document) {
    const title =
      cleanTitle($('[data-testid="chat-title-button"]', doc)?.textContent) ||
      cleanTitle($('[data-testid="page-header"]', doc)?.textContent) ||
      cleanTitle(root.title || doc.title) ||
      cleanTitle($('meta[property="og:title"]', doc)?.content) ||
      "ChatGPT Conversation";
    const date = formatLocalIso(new Date());
    const source = doc.location?.href || "";
    let mdOutput = `---\ntitle: "${yamlEscape(title)}"\ndate: ${date}\nsource: "${yamlEscape(source)}"\n---\n\n`;

    getTurns(doc).forEach((turn) => {
      const content = extractTurn(turn);
      if (content) mdOutput += `## ${turn.role}\n\n${content}\n\n---\n\n`;
    });

    return mdOutput;
  }

  const shouldClick = (node) => {
    const text = cleanText(node.innerText || node.textContent || node.getAttribute("aria-label"));
    if (!node.closest("section[data-testid^='conversation-turn-']")) return false;
    if (node.hidden || node.closest("[hidden]")) return false;
    if (node.dataset?.aiscraperExpanded) return false;
    const target = node.getAttribute("for") ? root.document.getElementById(node.getAttribute("for")) : null;
    if (target?.checked) return false;
    if (isThoughtButton(node)) return true;
    if (/show more/i.test(text)) return true;
    if (/copy|more actions|sources|rate|regenerate|edit|share|download|read aloud/i.test(text)) return false;
    return (
      node.getAttribute("aria-expanded") === "false" &&
      /reason|think|thought|tool|search|view|expand|called/i.test(text)
    );
  };

  async function expandChatGPTContent(doc = root.document, win = root, limit = 80) {
    for (let i = 0; i < limit; i += 1) {
      const node = Array.from(doc.querySelectorAll("button, label")).find(shouldClick);
      if (!node) return;
      const thoughtLabel = isThoughtButton(node) ? cleanText(node.innerText || node.textContent) : "";
      node.click();
      if (thoughtLabel) {
        const panel = await waitForReasoningPanel(doc, win, thoughtLabel);
        const markdown = formatThoughtDetails(thoughtLabel, panel);
        if (markdown) node.dataset.aiscraperMarkdown = markdown;
      } else {
        await new Promise((resolve) => win.setTimeout(resolve, 250));
      }
      node.dataset.aiscraperExpanded = "true";
    }
  }

  async function copyText(text, doc = root.document, nav = root.navigator) {
    try {
      await nav?.clipboard?.writeText?.(text);
      return true;
    } catch {
      const textarea = doc.createElement("textarea");
      textarea.value = text;
      doc.body.appendChild(textarea);
      textarea.select();
      const ok = doc.execCommand?.("copy");
      textarea.remove();
      return Boolean(ok);
    }
  }

  async function copyConversation(doc = root.document, win = root, nav = root.navigator) {
    const markdown = extractConversation(doc);
    const ok = await copyText(markdown, doc, nav);
    const notify = win?.alert ?? console.warn;
    notify(ok ? "ChatGPT conversation copied to clipboard." : "Failed to copy ChatGPT conversation.");
    return markdown;
  }

  async function scrape(doc = root.document, win = root, nav = root.navigator) {
    await expandChatGPTContent(doc, win);
    await new Promise((resolve) => win.setTimeout(resolve, 500));
    return copyConversation(doc, win, nav);
  }

  root.chatgptscraper = {
    extractConversation,
    copyConversation,
    expandChatGPTContent,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
