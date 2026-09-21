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
  const cleanTitle = (value, product = "Claude") => {
    const title = cleanText(value).replace(new RegExp(`\\s+-\\s+${product}$`, "i"), "");
    return title && !new RegExp(`^(?:${product}|${product} Conversation|New chat)$`, "i").test(title) ? title : "";
  };
  const isHidden = (node) => node.hidden || node.closest?.("[hidden], .sr-only, [aria-hidden='true']");
  const isBlockTag = (tag) =>
    /^(p|div|section|article|ul|ol|li|table|thead|tbody|tr|blockquote|pre|hr|h[1-6])$/.test(tag);

  function fenceCode(code, language = "") {
    const fence = code.includes("```") ? "````" : "```";
    return `\n${fence}${language}\n${code.replace(/\n+$/g, "")}\n${fence}\n\n`;
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
    if (tag === "script" || tag === "style" || tag === "svg") return "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "pre") return fenceCode(node.innerText || node.textContent || "");
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
    if (tag === "button") {
      if (node.getAttribute("aria-expanded") !== null || /show (more|less)/i.test(node.textContent || "")) return "";
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

  const isClaudeResponseRoot = (node) =>
    node.matches?.("[data-is-streaming]") ||
    cleanText(node.querySelector?.("h2")?.textContent).toLowerCase().startsWith("claude responded");
  const responseRootFor = (node, doc = root.document) =>
    node.closest("[data-is-streaming]") ||
    Array.from(doc.querySelectorAll("section, article, div")).find(
      (candidate) => candidate.contains(node) && isClaudeResponseRoot(candidate),
    ) ||
    node.closest(".group");
  const responseBodyFor = (node) =>
    $(".font-claude-response", node) ||
    Array.from(node.querySelectorAll("div")).find((candidate) =>
      Array.from(candidate.children).some((child) =>
        /^(p|h[1-6]|ul|ol|table|pre|blockquote|div)$/i.test(child.tagName),
      ),
    ) ||
    node;

  function thinkingContentFor(button, responseNode) {
    const controlledId = button.getAttribute("aria-controls");
    const controlled = controlledId ? button.ownerDocument.getElementById(controlledId) : null;
    if (controlled && responseNode.contains(controlled)) return controlled;

    let ancestor = button.parentElement;
    for (let depth = 0; ancestor && ancestor !== responseNode.parentElement && depth < 6; depth += 1) {
      const candidate = Array.from(ancestor.children).find(
        (child) => !child.contains(button) && cleanText(child.textContent),
      );
      if (candidate) return candidate;
      ancestor = ancestor.parentElement;
    }

    return button.closest(".grid")?.querySelector(".overflow-hidden") || null;
  }

  function transcriptRowsFor(doc, rows = null) {
    if (rows?.length) return rows;
    return Array.from(doc.querySelectorAll('[data-testid="transcript-row"]'));
  }

  function turnForTranscriptRow(row) {
    const isUser = row.dataset?.perfRow === "human" || row.querySelector('[data-testid="user-message"]');
    return {
      role: isUser ? "User" : "Claude",
      node:
        row.querySelector(
          isUser
            ? '[data-testid="user-message"], [data-message-author-role="user"]'
            : '[data-testid="assistant-message"], [data-is-streaming], .font-claude-response',
        ) || row,
    };
  }

  function getTurns(doc = root.document, rows = null) {
    const transcriptRows = transcriptRowsFor(doc, rows);
    if (transcriptRows.length) return transcriptRows.map(turnForTranscriptRow);

    const turnNodes = [
      ...doc.querySelectorAll(
        '[data-testid="user-message"], [data-message-author-role="user"], [data-is-streaming], .font-claude-response',
      ),
      ...Array.from(doc.querySelectorAll("h2")).filter((node) =>
        cleanText(node.textContent).toLowerCase().startsWith("claude responded"),
      ),
    ];
    const seen = new Set();
    return turnNodes
      .map((node) => {
        const responseRoot = node.matches?.('[data-testid="user-message"], [data-message-author-role="user"]')
          ? null
          : responseRootFor(node, doc);
        const key = responseRoot || node;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          role: responseRoot ? "Claude" : "User",
          node: responseRoot || node,
        };
      })
      .filter(Boolean);
  }

  const toolButtonLabel = (button) => {
    const text = cleanText(button.innerText || button.textContent);
    return /^(Loading tools|Bash|Result)$/i.test(text) ? text : "";
  };

  function toolBlockFor(button, responseNode) {
    const label = toolButtonLabel(button);
    if (!label) return null;
    let ancestor = button.parentElement;
    for (let depth = 0; ancestor && responseNode.contains(ancestor) && depth < 8; depth += 1) {
      const text = cleanText(ancestor.innerText || ancestor.textContent);
      if (/\bRequest\b/i.test(text) && /\bResponse\b/i.test(text)) return ancestor;
      ancestor = ancestor.parentElement;
    }
    return null;
  }

  const compactToolPayload = (text) =>
    String(text || "")
      .replace(/\b(Copy|Result)\b\s*/g, "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^\{\s+("[^"]+":|[A-Za-z_$][\w$]*:)/, "{\n  $1")
      .replace(/\s+\}$/g, "\n}")
      .replace(/\n{3,}/g, "\n\n");

  function formatToolBlock(block) {
    const lines = (block.innerText || block.textContent || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const label = lines.find((line) => /^(Loading tools|Bash)$/i.test(line)) || "Tool";
    const requestIndex = lines.findIndex((line) => /^Request$/i.test(line));
    const responseIndex = lines.findIndex((line, index) => index > requestIndex && /^Response$/i.test(line));
    if (requestIndex === -1) return "";
    const request = compactToolPayload(
      lines.slice(requestIndex + 1, responseIndex === -1 ? undefined : responseIndex).join("\n"),
    );
    const response = responseIndex === -1 ? "" : compactToolPayload(lines.slice(responseIndex + 1).join("\n"));
    return `<details>\n<summary>Called tool: ${label}</summary>\n\nRequest\n\n\`\`\`\n${request}\n\`\`\`\n${
      response ? `\nResponse\n\n\`\`\`\n${response}\n\`\`\`\n` : ""
    }\n</details>`;
  }

  function topLevelToolBlocks(responseNode) {
    const blocks = Array.from(responseNode.querySelectorAll("button"))
      .map((button) => toolBlockFor(button, responseNode))
      .filter(Boolean);
    return blocks.filter((block, index) => blocks.indexOf(block) === index);
  }

  function removeToolBlocks(node) {
    topLevelToolBlocks(node).forEach((block) => block.remove());
  }

  function extractThinking(responseNode) {
    return Array.from(responseNode.querySelectorAll("button[aria-expanded]"))
      .filter((button) => !button.closest("nav, header, fieldset"))
      .map((button) => {
        const content = thinkingContentFor(button, responseNode);
        const summary = cleanText(button.innerText || button.textContent);
        const markdown = content ? parseChildren(content).trim() : "";
        return { button, content, summary, markdown };
      })
      .filter((thought) => thought.summary || thought.markdown);
  }

  function extractResponse(responseNode) {
    const toolMarkdowns = topLevelToolBlocks(responseNode).map(formatToolBlock).filter(Boolean);
    const clone = responseNode.cloneNode(true);
    removeToolBlocks(clone);
    clone.querySelectorAll(".sr-only, [aria-hidden='true']").forEach((node) => node.remove());
    const thoughts = extractThinking(clone);
    thoughts.forEach((thought) => {
      thought.content?.remove();
      thought.button.remove();
    });

    let output = "";
    thoughts.forEach((thought) => {
      output += `<details>\n<summary>${thought.summary || "Thinking"}</summary>\n\n`;
      if (thought.markdown) output += `> ${thought.markdown.replace(/\n/g, "\n> ")}\n\n`;
      output += "</details>\n\n";
    });
    if (toolMarkdowns.length) output += `${toolMarkdowns.join("\n\n")}\n\n`;

    const body = responseBodyFor(clone);
    output += parseChildren(body).trim();
    return output.trim();
  }

  function extractConversation(doc = root.document, rows = null) {
    const title =
      cleanTitle($('[data-testid="chat-title-button"]', doc)?.textContent) ||
      cleanTitle($('[data-testid="page-header"]', doc)?.textContent) ||
      cleanTitle(root.title || doc.title) ||
      "Claude Conversation";
    const date = formatLocalIso(new Date());
    const source = doc.location?.href || "";
    let mdOutput = `---\ntitle: "${yamlEscape(title)}"\ndate: ${date}\nsource: "${yamlEscape(source)}"\n---\n\n`;

    getTurns(doc, rows).forEach((turn) => {
      const content = turn.role === "Claude" ? extractResponse(turn.node) : parseChildren(turn.node).trim();
      if (content) mdOutput += `## ${turn.role}\n\n${content}\n\n---\n\n`;
    });

    return mdOutput;
  }

  const shouldClick = (button) => {
    const text = cleanText(button.innerText || button.textContent || button.getAttribute("aria-label"));
    if (button.hidden || button.closest("[hidden]")) return false;
    if (button.dataset?.aiscraperExpanded) return false;
    if (button.closest("nav, header, fieldset, [data-testid='user-message']")) return false;
    const response = button.closest('[data-testid="assistant-message"], [data-is-streaming], .font-claude-response');
    if (!response) return false;
    if (/^(copy|retry|edit|share|more actions|save|download|view)/i.test(text)) return false;
    if (button.getAttribute("aria-label") && !/^show more$/i.test(text)) return false;
    if (/^(Loading tools|Bash|Result)$/i.test(text)) return true;
    if (button.matches('[data-testid="tool-status-pill"]')) return true;
    if (button.getAttribute("aria-expanded") === "false") return true;
    return /^show more$/i.test(text);
  };

  async function expandClaudeContent(doc = root.document, win = root, limit = 80) {
    for (let i = 0; i < limit; i += 1) {
      const button = Array.from(doc.querySelectorAll("button")).find(shouldClick);
      if (!button) return;
      button.dataset.aiscraperExpanded = "true";
      button.click();
      await new Promise((resolve) => win.setTimeout(resolve, 250));
    }
  }

  function transcriptRowId(row, index) {
    return row.dataset.index ?? row.querySelector('[role="article"]')?.getAttribute("aria-posinset") ?? `row-${index}`;
  }

  function extractMessages(doc = root.document, rows = null) {
    return getTurns(doc, rows).flatMap((turn, index) => {
      const content = turn.role === "Claude" ? extractResponse(turn.node) : parseChildren(turn.node).trim();
      if (!content) return [];
      const row = turn.node.closest('[data-testid="transcript-row"]');
      return [
        {
          id: String(transcriptRowId(row || turn.node, index)),
          role: turn.role === "User" ? "user" : "assistant",
          content,
        },
      ];
    });
  }

  function messagesToPrompts(messages, metadata) {
    const prompts = messages.filter(({ role }) => role === "user").map(({ content }) => content);
    return `<!-- ${metadata.title}: ${metadata.source} (${metadata.date}) -->\n\n${prompts.join("\n\n---\n\n")}\n`;
  }

  function createScraperState(doc = root.document) {
    return {
      metadata: {
        title: cleanTitle($("[data-testid='chat-title-button']", doc)?.textContent) || cleanTitle(doc.title) || "Claude Conversation",
        date: formatLocalIso(new Date()),
        source: doc.location?.href || "",
      },
      rowsById: new Map(),
      rowOrder: new Map(),
      rows: [],
      messages: [],
      captureTimer: null,
      observer: null,
      expanding: false,
      active: true,
    };
  }

  function captureRows(doc, state) {
    const visibleRows = transcriptRowsFor(doc);
    visibleRows.forEach((row, index) => {
      const id = String(transcriptRowId(row, index));
      state.rowsById.set(id, row.cloneNode(true));
      const order = Number(row.dataset.index ?? row.querySelector('[role="article"]')?.getAttribute("aria-posinset"));
      state.rowOrder.set(id, Number.isFinite(order) ? order : index);
    });
    state.rows = [...state.rowsById.keys()]
      .sort((left, right) => state.rowOrder.get(left) - state.rowOrder.get(right))
      .map((id) => state.rowsById.get(id));
    return state.rows;
  }

  function mountCopyControls(doc, onCopy) {
    doc.getElementById("claudescraper-copy-controls")?.remove();
    doc.body.insertAdjacentHTML(
      "beforeend",
      '<div id="claudescraper-copy-controls" role="group" aria-label="Copy captured Claude messages" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:12px system-ui,sans-serif;color-scheme:light"><button id="claudescraper-copy-markdown-btn" data-format="markdown" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="claudescraper-copy-json-btn" data-format="json" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="claudescraper-copy-prompts-btn" data-format="prompts" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="claudescraper-copy-close-btn" type="button" aria-label="Close scraper controls" title="Close" data-action="close" style="padding:2px 10px;background:#dc3545;color:#fff;border:1px solid #dc3545;border-radius:5px;cursor:pointer">×</button></div>',
    );
    const controls = doc.getElementById("claudescraper-copy-controls");
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
          const label = format === "json" ? "JSON" : format === "markdown" ? "Markdown" : "prompts";
          doc.getElementById(`claudescraper-copy-${format}-btn`).textContent =
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

  async function copyConversation(doc = root.document, win = root, nav = root.navigator, rows = null) {
    const markdown = extractConversation(doc, rows);
    const ok = await copyText(markdown, doc, nav);
    if (!ok) (win?.alert ?? console.warn)("Failed to copy Claude conversation.");
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
    const previousState = root.__claudescraperState;
    if (previousState?.captureTimer) clearIntervalFn(previousState.captureTimer);
    previousState?.observer?.disconnect();
    if (previousState) previousState.active = false;
    state.active = true;
    const stop = () => {
      clearIntervalFn(state.captureTimer);
      state.observer?.disconnect();
      state.captureTimer = null;
      state.active = false;
    };
    const controls = mountCopyControls(doc, async (format, button) => {
      button.disabled = true;
      button.textContent = "Preparing…";
      captureRows(doc, state);
      state.messages = extractMessages(doc, state.rows.length ? state.rows : null);
      const payload =
        format === "markdown"
          ? extractConversation(doc, state.rows.length ? state.rows : null)
          : format === "prompts"
            ? messagesToPrompts(state.messages, state.metadata)
            : JSON.stringify(state.messages, null, 2);
      if (!(await copyText(payload, doc, nav))) (win?.alert ?? console.warn)("Failed to copy Claude conversation.");
      button.disabled = false;
      if (state.active) controls.updateCount(state.messages.length, state.messages.filter(({ role }) => role === "user").length);
    });
    const closeButton = doc.getElementById("claudescraper-copy-close-btn");
    closeButton.addEventListener("click", () => {
      stop();
      controls.remove();
    });
    const refresh = () => {
      if (!state.active) return;
      const rows = captureRows(doc, state);
      state.messages = extractMessages(doc, rows.length ? rows : null);
      controls.updateCount(state.messages.length, state.messages.filter(({ role }) => role === "user").length);
      if (state.expanding) return;
      state.expanding = true;
      void expandClaudeContent(doc, win).finally(() => {
        state.expanding = false;
        if (!state.active) return;
        const expandedRows = captureRows(doc, state);
        state.messages = extractMessages(doc, expandedRows.length ? expandedRows : null);
        controls.updateCount(state.messages.length, state.messages.filter(({ role }) => role === "user").length);
      });
    };
    refresh();
    const Observer = win.MutationObserver || root.MutationObserver;
    const transcript = doc.querySelector('[data-testid="transcript-list"]');
    if (Observer && transcript) {
      state.observer = new Observer(refresh);
      state.observer.observe(transcript, { childList: true, subtree: true });
    }
    state.captureTimer = setIntervalFn(refresh, 500);
    root.__claudescraperState = state;
    return state;
  }

  root.claudescraper = {
    extractConversation,
    copyConversation,
    captureRows,
    createScraperState,
    extractMessages,
    expandClaudeContent,
    messagesToPrompts,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
