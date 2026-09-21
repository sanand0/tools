// @ts-check
(function (root) {
  const nodeTypes = root.Node || { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  const roleLabels = { user: "User", assistant: "ChatGPT" };

  function formatLocalIso(date) {
    const pad = (value) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const offset = Math.abs(offsetMinutes);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
  }

  const yamlEscape = (value) =>
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ");

  function conversationMetadata(doc = root.document, date = new Date()) {
    const cleanTitle = (value) =>
      cleanText(value).replace(/\s+-\s+ChatGPT$/i, "");
    const candidates = [
      doc.querySelector('[data-testid="chat-title-button"]')?.textContent,
      doc.querySelector('[data-testid="page-header"]')?.textContent,
      doc.title,
      doc.querySelector('meta[property="og:title"]')?.content,
    ];
    const title = candidates
      .map(cleanTitle)
      .find(
        (value) =>
          value && !/^(?:ChatGPT|ChatGPT Conversation|New chat)$/i.test(value),
      );
    return {
      title: title || "ChatGPT Conversation",
      date: formatLocalIso(date),
      source: doc.location?.href || "",
    };
  }

  const normalizeTimestamp = (value) => {
    if (value == null || value === "") return undefined;
    const numeric = Number(value);
    const date = new Date(
      Number.isFinite(numeric) ? numeric * (numeric < 1e12 ? 1000 : 1) : value,
    );
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  const cleanText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const isBlockTag = (tag) =>
    /^(p|div|section|article|ul|ol|li|table|thead|tbody|tr|blockquote|pre|hr|h[1-6])$/.test(
      tag,
    );
  const isHidden = (node) =>
    node.hidden || node.closest?.("[hidden], .sr-only, [aria-hidden='true']");

  function textWithBreaks(node) {
    if (!node) return "";
    if (node.nodeType === nodeTypes.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== nodeTypes.ELEMENT_NODE) return "";
    if (node.tagName?.toLowerCase() === "br") return "\n";
    return Array.from(node.childNodes).map(textWithBreaks).join("");
  }

  function textNodeMarkdown(node) {
    const text = node.textContent || "";
    if (!text.trim()) return text.includes("\n") ? "" : text;
    if (!text.includes("\n")) return text.replace(/\s+/g, " ");
    return text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
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
    const padded = rows.map((row) => [
      ...row,
      ...Array(columnCount - row.length).fill(""),
    ]);
    const [header, ...body] = padded;
    const renderRow = (cells) => `| ${cells.join(" | ")} |`;
    return `${renderRow(header)}\n${renderRow(Array(columnCount).fill("---"))}${
      body.length ? `\n${body.map(renderRow).join("\n")}` : ""
    }\n\n`;
  }

  function parseLink(node) {
    const href = node.getAttribute("href") || "#";
    const directText = Array.from(node.children)
      .map((child) => cleanText(child.innerText || child.textContent))
      .filter(Boolean);
    const isCard =
      directText.length > 1 ||
      Array.from(node.parentElement?.children || []).filter(
        (child) => child.tagName === "A",
      ).length > 1;
    if (isCard) {
      const [title, ...meta] = directText;
      return `* [${title || href}](${href})${meta.length ? ` - ${meta.join(" - ")}` : ""}\n`;
    }
    return `[${parseChildren(node).trim() || href}](${href})`;
  }

  function parseNode(node) {
    if (node.nodeType === nodeTypes.TEXT_NODE) return textNodeMarkdown(node);
    if (node.nodeType !== nodeTypes.ELEMENT_NODE || isHidden(node)) return "";
    if (node.dataset?.aiscraperMarkdown)
      return `\n${node.dataset.aiscraperMarkdown}\n\n`;

    const tag = node.tagName.toLowerCase();
    if (
      [
        "script",
        "style",
        "svg",
        "input",
        "button",
        "label",
        "textarea",
      ].includes(tag)
    )
      return "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "pre") {
      const codeNode =
        node.querySelector(":scope > code") ||
        node.querySelector("pre code") ||
        node.querySelector("code");
      const language =
        codeNode?.className?.match?.(/(?:^|\s)language-([\w+-]+)/)?.[1] || "";
      return fenceCode(
        codeNode
          ? textWithBreaks(codeNode)
          : node.innerText || node.textContent || "",
        language,
      );
    }
    if (tag === "code") {
      if (node.closest("pre")) return node.textContent || "";
      return `\`${(node.textContent || "").replace(/\s+/g, " ").trim()}\``;
    }
    if (tag === "table") return parseTable(node);
    if (tag === "strong" || tag === "b") return `**${parseChildren(node)}**`;
    if (tag === "em" || tag === "i") return `*${parseChildren(node)}*`;
    if (tag === "a") return parseLink(node);
    if (/^h[1-6]$/.test(tag))
      return `${"#".repeat(Number(tag[1]))} ${parseChildren(node).trim()}\n\n`;
    if (tag === "li") {
      const parent = node.parentElement;
      const marker =
        parent?.tagName?.toLowerCase() === "ol"
          ? `${Array.from(parent.children).indexOf(node) + 1}. `
          : "* ";
      return `${marker}${parseChildren(node).trim()}\n`;
    }
    if (tag === "ul" || tag === "ol") return `${parseChildren(node)}\n`;
    if (tag === "blockquote")
      return `> ${parseChildren(node).trim().replace(/\n/g, "\n> ")}\n\n`;
    const content = parseChildren(node);
    return tag === "p" ? `${content.trim()}\n\n` : content;
  }

  function parseChildren(node) {
    return Array.from(node.childNodes).reduce((output, child) => {
      const chunk = parseNode(child);
      if (!chunk) return output;
      if (child.nodeType === nodeTypes.TEXT_NODE) {
        if (!chunk.trim())
          return output.endsWith(" ") || output.endsWith("\n")
            ? output
            : `${output} `;
        return output + chunk;
      }
      if (isBlockTag(child.tagName.toLowerCase())) {
        output = output.replace(/[ \t]+$/g, "");
        if (output && !output.endsWith("\n")) output += "\n\n";
      }
      if (chunk.startsWith("* [")) output = output.replace(/[ \t]+$/g, "");
      return output + chunk;
    }, "");
  }

  const compactToolPayload = (lines) =>
    lines
      .filter((line) => line !== "Copy")
      .join("\n")
      .replace(/(^|\n)\s*Copy\s+/g, "$1")
      .trim()
      .replace(/^\{\n([A-Za-z_$][\w$]*):\s*\n([\s\S]*)\n\}$/g, "{$1: $2}")
      .replace(/^\{\s+([A-Za-z_$][\w$]*):\s*/g, "{$1: ")
      .replace(/\n\s*\n/g, "\n");

  function formatToolDetails(tool, action, request, response) {
    const actionLabel = /^call tool$/i.test(action) ? "Call Tool" : action;
    const responseBody =
      response && /^[{[]/.test(response)
        ? `\n\`\`\`\n${response}\n\`\`\`\n`
        : `\n${response}\n`;
    return `<details>\n<summary>Called tool: ${tool}${actionLabel ? ` - ${actionLabel}` : ""}</summary>\n\nRequest\n\n\`\`\`\n${request}\n\`\`\`\n${response ? `\nResponse\n${responseBody}` : ""}\n</details>`;
  }

  function formatToolMessage(node) {
    const lines = (node.innerText || node.textContent || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const calledIndex = lines.findIndex((line) => /^Called tool$/i.test(line));
    const requestIndex = lines.findIndex((line) => /^Request$/i.test(line));
    const responseIndex = lines.findIndex(
      (line, index) => index > requestIndex && /^Response$/i.test(line),
    );
    if (calledIndex === -1 || requestIndex === -1) {
      const compact = cleanText(node.textContent);
      const match = compact.match(
        /^Called tool\s+([\s\S]+?)\s+Request\s+([\s\S]*?)(?:\s+Response\s+([\s\S]+))?$/i,
      );
      if (!match) return "";
      const descriptor = match[1].trim();
      const action = descriptor.endsWith(" Call tool")
        ? "Call tool"
        : descriptor.split(/\s+/).pop();
      const tool = descriptor.endsWith(" Call tool")
        ? descriptor.replace(/\s+Call tool$/, "")
        : descriptor.replace(
            new RegExp(`\\s+${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
            "",
          );
      return formatToolDetails(
        tool || "Tool",
        action || "",
        compactToolPayload([match[2]]),
        match[3] ? compactToolPayload([match[3]]) : "",
      );
    }
    const tool = lines[calledIndex + 1] || "Tool";
    const action =
      lines[calledIndex + 2] && !/^Request$/i.test(lines[calledIndex + 2])
        ? lines[calledIndex + 2]
        : "";
    const request = compactToolPayload(
      lines.slice(
        requestIndex + 1,
        responseIndex === -1 ? undefined : responseIndex,
      ),
    );
    const response =
      responseIndex === -1
        ? ""
        : compactToolPayload(lines.slice(responseIndex + 1));
    return formatToolDetails(tool, action, request, response);
  }

  const attachmentLabel = (node) =>
    cleanText(
      node.getAttribute?.("aria-label") || node.getAttribute?.("title"),
    );
  const isAttachment = (node) => {
    const label = attachmentLabel(node);
    if (!label) return false;
    const text = cleanText(node.innerText || node.textContent);
    return (
      node.getAttribute?.("role") === "group" &&
      (/\bfile\b/i.test(text) ||
        Array.from(node.querySelectorAll?.("button[aria-label]") || []).some(
          (button) => attachmentLabel(button) === label,
        ))
    );
  };

  const topLevelMatches = (nodes) =>
    nodes.filter(
      (node) =>
        !nodes.some((parent) => parent !== node && parent.contains(node)),
    );

  function cloneForExtraction(message, role) {
    const content =
      role === "assistant"
        ? message.querySelector(".markdown") || message
        : message;
    const clone = content.cloneNode(true);
    const isTool = (node) => {
      const text = cleanText(node.innerText || node.textContent);
      return (
        String(node.getAttribute?.("class") || "").includes("tool-message") ||
        (/^Called tool\b/i.test(text) && /\bRequest\b/i.test(text))
      );
    };
    const sourceTools = topLevelMatches(
      Array.from(content.querySelectorAll("*")).filter(isTool),
    );
    topLevelMatches(
      Array.from(clone.querySelectorAll("*")).filter(isTool),
    ).forEach((node, index) => {
      const markdown = formatToolMessage(sourceTools[index] || node);
      if (!markdown) return;
      const replacement = clone.ownerDocument.createElement("div");
      replacement.dataset.aiscraperMarkdown = markdown;
      node.replaceWith(replacement);
    });
    const sourceAttachments = Array.from(
      content.querySelectorAll("[role='group'][aria-label]"),
    ).filter(isAttachment);
    Array.from(clone.querySelectorAll("[role='group'][aria-label]"))
      .filter(isAttachment)
      .forEach((node, index) => {
        const source = sourceAttachments[index] || node;
        const filename = attachmentLabel(source);
        const type = (source.innerText || source.textContent || "")
          .split(/\r?\n/)
          .map(cleanText)
          .find(
            (line) =>
              line !== filename &&
              /^(?:file|image|document|spreadsheet|pdf|csv)$/i.test(line),
          );
        const replacement = clone.ownerDocument.createElement("div");
        replacement.dataset.aiscraperMarkdown = `* Attachment: ${filename}${type ? ` (${type})` : ""}`;
        node.replaceWith(replacement);
      });
    clone
      .querySelectorAll(
        "[data-testid='collapsible-user-message-content'] [hidden]",
      )
      .forEach((node) => node.removeAttribute("hidden"));
    clone.querySelectorAll("button").forEach((button) => {
      if (
        /^(?:Thought|Worked) for /i.test(
          cleanText(button.innerText || button.textContent),
        )
      )
        button.nextElementSibling?.remove();
      button.remove();
    });
    clone
      .querySelectorAll(
        "nav, menu, form, textarea, label, input, svg, .sr-only, [aria-hidden='true']",
      )
      .forEach((node) => node.remove());
    clone.querySelectorAll("*").forEach((node) => {
      if (
        /^(?:Looked for available tools)?(?:Called tool)+$/i.test(
          cleanText(node.innerText || node.textContent),
        )
      )
        node.remove();
    });
    return clone;
  }

  function getMessageRecords(doc = root.document) {
    const nodes = Array.from(
      doc.querySelectorAll(
        '[data-message-author-role="user"], [data-message-author-role="assistant"]',
      ),
    ).filter(
      (node) => !node.parentElement?.closest?.("[data-message-author-role]"),
    );
    return nodes.flatMap((node, index) => {
      const role = node.getAttribute("data-message-author-role");
      const content = parseChildren(cloneForExtraction(node, role)).trim();
      if (!roleLabels[role] || !content) return [];
      const turn = node.closest("section[data-testid^='conversation-turn-']");
      const turnId = turn?.getAttribute("data-testid") || "";
      const id =
        node.getAttribute("data-message-id") ||
        turnId ||
        node.id ||
        `${role}-${index + 1}`;
      const order = Number(turnId.match(/conversation-turn-(\d+)/)?.[1]);
      const timestamp = normalizeTimestamp(
        turn?.querySelector("time[datetime]")?.getAttribute("datetime"),
      );
      return [
        {
          id,
          role,
          content,
          order: Number.isFinite(order) ? order : index,
          ...(timestamp && { timestamp }),
        },
      ];
    });
  }

  const publicMessage = ({ id, role, content, timestamp }) => ({
    id,
    role,
    content,
    ...(timestamp && { timestamp }),
  });
  const extractMessages = (doc = root.document) =>
    getMessageRecords(doc).map(publicMessage);

  function messagesToMarkdown(
    messages,
    metadata = conversationMetadata(root.document),
  ) {
    const frontmatter = `---\ntitle: "${yamlEscape(metadata.title)}"\ndate: ${metadata.date}\nsource: "${yamlEscape(metadata.source)}"\n---`;
    const transcript = messages
      .map(
        ({ role, content, timestamp }) =>
          `# ${roleLabels[role]}\n\n${timestamp ? `_${timestamp}_\n\n` : ""}${content}`,
      )
      .join("\n\n");
    return `${frontmatter}\n\n${transcript}\n`;
  }

  function messagesToPrompts(
    messages,
    metadata = conversationMetadata(root.document),
  ) {
    const prompts = messages
      .filter(({ role }) => role === "user")
      .map(({ content }) => content);
    return `<!-- ${metadata.title}: ${metadata.source} (${metadata.date}) -->\n\n${prompts.join("\n\n---\n\n")}\n`;
  }

  const extractConversation = (doc = root.document) =>
    messagesToMarkdown(extractMessages(doc), conversationMetadata(doc));

  function createScraperState(doc = root.document) {
    return {
      metadata: conversationMetadata(doc),
      messagesById: new Map(),
      messageIds: [],
      successorsById: new Map(),
      timestampsById: new Map(),
      messages: [],
      captureTimer: null,
      timestampsPromise: Promise.resolve(new Map()),
      active: true,
    };
  }

  function mergeMessageIds(existing, visible, messagesById) {
    const merged = [...existing];
    visible.forEach((id, index) => {
      if (merged.includes(id)) return;
      const previous = visible
        .slice(0, index)
        .reverse()
        .find((candidate) => merged.includes(candidate));
      const next = visible
        .slice(index + 1)
        .find((candidate) => merged.includes(candidate));
      if (previous) {
        merged.splice(merged.indexOf(previous) + 1, 0, id);
        return;
      }
      if (next) {
        merged.splice(merged.indexOf(next), 0, id);
        return;
      }
      const order = messagesById.get(id)?.order;
      const position = merged.findIndex(
        (candidate) => messagesById.get(candidate)?.order > order,
      );
      merged.splice(position === -1 ? merged.length : position, 0, id);
    });
    return merged;
  }

  function orderMessageIds(messageIds, visible, successorsById) {
    visible.forEach((id, index) => {
      const successors = successorsById.get(id) || new Set();
      visible
        .slice(index + 1)
        .forEach((successor) => successors.add(successor));
      successorsById.set(id, successors);
    });
    const ids = new Set(messageIds);
    const indegree = new Map(messageIds.map((id) => [id, 0]));
    successorsById.forEach((successors, id) => {
      if (!ids.has(id)) return;
      successors.forEach((successor) => {
        if (ids.has(successor))
          indegree.set(successor, indegree.get(successor) + 1);
      });
    });
    const remaining = new Set(messageIds);
    const ordered = [];
    while (remaining.size) {
      const next = messageIds.find(
        (id) => remaining.has(id) && indegree.get(id) === 0,
      );
      if (!next) return messageIds;
      ordered.push(next);
      remaining.delete(next);
      successorsById.get(next)?.forEach((successor) => {
        if (remaining.has(successor))
          indegree.set(successor, indegree.get(successor) - 1);
      });
    }
    return ordered;
  }

  function captureMessages(doc, state) {
    const visible = getMessageRecords(doc);
    const visibleIds = visible.map(({ id }) => id);
    visible.forEach((message) => {
      const timestamp =
        message.timestamp ||
        state.timestampsById.get(message.id) ||
        state.messagesById.get(message.id)?.timestamp;
      state.messagesById.set(message.id, {
        ...message,
        ...(timestamp && { timestamp }),
      });
    });
    state.messageIds = orderMessageIds(
      mergeMessageIds(state.messageIds, visibleIds, state.messagesById),
      visibleIds,
      state.successorsById,
    );
    state.messages = state.messageIds.map((id) =>
      publicMessage(state.messagesById.get(id)),
    );
    return state.messages;
  }

  async function fetchMessageTimestamps(doc = root.document) {
    const conversationId = doc.location?.pathname?.match(/\/c\/([^/?#]+)/)?.[1];
    const fetchFn = doc.defaultView?.fetch?.bind(doc.defaultView);
    if (!conversationId || !fetchFn) return new Map();
    const paths = [
      `/backend-api/conversations/${conversationId}?include_has_versions=true&num_turns=1000`,
      `/backend-api/conversation/${conversationId}`,
    ];
    for (const path of paths) {
      try {
        const response = await fetchFn(path, { credentials: "same-origin" });
        if (!response.ok) continue;
        const data = await response.json();
        const mapping =
          data?.mapping || data?.conversation?.mapping || data?.data?.mapping;
        const timestamps = new Map();
        Object.values(mapping || {}).forEach(({ message }) => {
          const timestamp = normalizeTimestamp(message?.create_time);
          if (message?.id && timestamp) timestamps.set(message.id, timestamp);
        });
        if (timestamps.size) return timestamps;
      } catch {
        // Timestamp enrichment is optional; DOM extraction remains usable.
      }
    }
    return new Map();
  }

  function mountCopyControls(doc, onCopy) {
    doc.getElementById("chatgptscraper-copy-controls")?.remove();
    doc.body.insertAdjacentHTML(
      "beforeend",
      '<div id="chatgptscraper-copy-controls" role="group" aria-label="Copy captured messages" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:12px system-ui,sans-serif;color-scheme:light"><button id="chatgptscraper-copy-markdown-btn" data-format="markdown" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-json-btn" data-format="json" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-prompts-btn" data-format="prompts" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-close-btn" type="button" aria-label="Close scraper controls" title="Close" data-action="close" style="padding:2px 10px;background:#dc3545;color:#fff;border:1px solid #dc3545;border-radius:5px;cursor:pointer">×</button></div>',
    );
    const controls = doc.getElementById("chatgptscraper-copy-controls");
    controls.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-format]");
      if (button) onCopy(button.dataset.format, button);
      if (event.target.closest?.("button[data-action='close']")) controls.remove();
    });
    return {
      remove: () => controls.remove(),
      updateCount(count, promptCount = count) {
        for (const format of ["markdown", "json", "prompts"]) {
          const amount = format === "prompts" ? promptCount : count;
          const label =
            format === "json"
              ? "JSON"
              : format === "markdown"
                ? "Markdown"
                : "prompts";
          doc.getElementById(`chatgptscraper-copy-${format}-btn`).textContent =
            `Copy ${amount} ${label === "prompts" ? label : `messages as ${label}`}`;
        }
      },
    };
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

  async function copyConversation(
    doc = root.document,
    win = root,
    nav = root.navigator,
  ) {
    const markdown = extractConversation(doc);
    if (!(await copyText(markdown, doc, nav)))
      (win?.alert ?? console.warn)("Failed to copy ChatGPT conversation.");
    return markdown;
  }

  function scrape(
    doc = root.document,
    win = root,
    nav = root.navigator,
    state = createScraperState(doc),
    setIntervalFn = win.setInterval.bind(win),
    clearIntervalFn = win.clearInterval.bind(win),
  ) {
    const previousState = root.__chatgptscraperState;
    if (previousState?.captureTimer)
      clearIntervalFn(previousState.captureTimer);
    if (previousState) previousState.active = false;
    state.active = true;
    const stop = () => {
      clearIntervalFn(state.captureTimer);
      state.captureTimer = null;
      state.active = false;
    };
    const controls = mountCopyControls(doc, async (format, button) => {
      button.disabled = true;
      button.textContent = "Preparing…";
      await state.timestampsPromise;
      captureMessages(doc, state);
      const payload =
        format === "markdown"
          ? messagesToMarkdown(state.messages, state.metadata)
          : format === "prompts"
            ? messagesToPrompts(state.messages, state.metadata)
            : JSON.stringify(state.messages, null, 2);
      if (!(await copyText(payload, doc, nav)))
        (win?.alert ?? console.warn)("Failed to copy ChatGPT conversation.");
      button.disabled = false;
      if (state.active) controls.updateCount(state.messages.length, state.messages.filter(({ role }) => role === "user").length);
    });
    const closeButton = doc.getElementById("chatgptscraper-copy-close-btn");
    closeButton.addEventListener("click", () => {
      stop();
      controls.remove();
    });
    const update = () => {
      const messages = captureMessages(doc, state);
      controls.updateCount(
        messages.length,
        messages.filter(({ role }) => role === "user").length,
      );
    };
    update();
    state.timestampsPromise = fetchMessageTimestamps(doc).then((timestamps) => {
      if (!state.active) return timestamps;
      state.timestampsById = timestamps;
      update();
      return timestamps;
    });
    state.captureTimer = setIntervalFn(update, 500);
    root.__chatgptscraperState = state;
    return state;
  }

  root.chatgptscraper = {
    captureMessages,
    copyConversation,
    createScraperState,
    extractConversation,
    extractMessages,
    fetchMessageTimestamps,
    messagesToMarkdown,
    messagesToPrompts,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
