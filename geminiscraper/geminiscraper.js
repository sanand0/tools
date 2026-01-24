(function (root) {
  const $ = (selector, el = root.document) => el.querySelector(selector);
  const nodeTypes = root.Node || { TEXT_NODE: 3, ELEMENT_NODE: 1 };

  function formatLocalIso(date) {
    const pad = (value) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
      date.getMinutes(),
    )}:${pad(date.getSeconds())}${sign}${offsetHours}:${offsetMins}`;
  }

  function yamlEscape(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ");
  }

  function parseGeminiNode(node) {
    if (node.nodeType === nodeTypes.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === nodeTypes.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      if (tag === "code-block") {
        const lang = node.querySelector(".code-block-decoration span")?.textContent || "";
        const code = node.querySelector(".code-container")?.textContent || "";
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
      }

      if (tag === "b" || tag === "strong") return `**${parseChildren(node)}**`;
      if (tag === "i" || tag === "em") return `*${parseChildren(node)}*`;
      if (tag === "code") return `\`${node.textContent}\``;
      if (tag === "a") return `[${node.textContent}](${node.getAttribute("href") || "#"})`;

      if (tag === "p") {
        const inList = node.closest("li");
        return `${parseChildren(node)}${inList ? "\n" : "\n\n"}`;
      }
      if (tag === "br") return "\n";
      if (tag.match(/^h[1-6]$/)) {
        const level = "#".repeat(parseInt(tag[1], 10));
        return `${level} ${parseChildren(node)}\n\n`;
      }
      if (tag === "hr") return "\n---\n\n";

      if (tag === "li") {
        const parent = node.parentElement;
        const index = Array.from(parent.children).indexOf(node) + 1;
        const marker = parent.tagName.toLowerCase() === "ol" ? `${index}. ` : "* ";

        let indent = "";
        let p = parent.parentElement;
        while (p?.tagName.toLowerCase() === "li") {
          const grandparent = p.parentElement;
          const parentIndex = Array.from(grandparent.children).indexOf(p) + 1;
          const parentMarker = grandparent.tagName.toLowerCase() === "ol" ? `${parentIndex}. ` : "* ";
          indent = " ".repeat(parentMarker.length) + indent;
          p = grandparent.parentElement;
        }

        return `${indent}${marker}${parseChildren(node).trim()}\n`;
      }
      if (tag === "ul" || tag === "ol") {
        return `${parseChildren(node)}\n`;
      }

      return parseChildren(node);
    }
    return "";
  }

  function parseChildren(node) {
    return Array.from(node.childNodes).map(parseGeminiNode).join("");
  }

  async function waitForThoughtsContent(targets, win = root, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const pending = targets.filter((target) => !target.container.querySelector(".thoughts-content"));
      if (pending.length === 0) return;
      await new Promise((resolve) => win.setTimeout(resolve, 100));
    }
  }

  async function expandThoughts(doc = root.document, win = root) {
    const targets = Array.from(doc.querySelectorAll("button.thoughts-header-button"))
      .map((button) => ({ button, container: button.closest(".model-thoughts") }))
      .filter((target) => target.container && !target.container.querySelector(".thoughts-content"));

    targets.forEach((target) => target.button.click());
    if (targets.length > 0) {
      await waitForThoughtsContent(targets, win);
    }
  }

  function extractConversation(doc = root.document) {
    const title =
      $(".conversation-title-container .conversation-title", doc)?.textContent?.trim() || "Gemini Conversation";
    const date = formatLocalIso(new Date());
    const source = doc.location?.href || "";
    const conversations = doc.querySelectorAll(".conversation-container");
    let mdOutput = `---\ntitle: "${yamlEscape(title)}"\ndate: ${date}\nsource: "${yamlEscape(source)}"\n---\n\n`;

    conversations.forEach((conv) => {
      const userNode = conv.querySelector("user-query .query-text");
      if (userNode) {
        mdOutput += `## User\n\n${userNode.innerText.trim()}\n\n`;
      }

      const markdownNodes = conv.querySelectorAll("model-response .markdown");
      if (markdownNodes.length > 0) {
        mdOutput += "## Gemini\n\n";

        markdownNodes.forEach((node) => {
          const isThought = node.closest("model-thoughts");
          const content = parseGeminiNode(node).trim();

          if (content.length > 0) {
            if (isThought) {
              mdOutput += `<details>\n<summary>Thinking</summary>\n\n> ${content.replace(/\n/g, "\n> ")}\n\n</details>\n\n`;
            } else {
              mdOutput += `${content}\n\n`;
            }
          }
        });

        mdOutput += "---\n\n";
      }
    });

    return mdOutput;
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
    notify(ok ? "Gemini conversation copied to clipboard." : "Failed to copy Gemini conversation.");
    return markdown;
  }

  async function scrape(doc = root.document, win = root, nav = root.navigator) {
    await expandThoughts(doc, win);
    await new Promise((resolve) => win.setTimeout(resolve, 500));
    return copyConversation(doc, win, nav);
  }

  root.geminiscraper = {
    extractConversation,
    copyConversation,
    expandThoughts,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
