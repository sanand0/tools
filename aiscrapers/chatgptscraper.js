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
    const content = text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
    return `${/^\s/.test(text) && node.previousSibling ? " " : ""}${content}${/\s$/.test(text) && node.nextSibling ? " " : ""}`;
  }

  function fenceCode(code, language = "") {
    const fence = "`".repeat(
      Math.max(
        3,
        ...Array.from(code.matchAll(/`+/g), (match) => match[0].length + 1),
      ),
    );
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
    const component = node.dataset?.dComponent;
    if (
      node.dataset?.markdownCopy === "exclude" ||
      component === "favicon" ||
      component === "icon"
    )
      return "";
    if (node.dataset?.markdownCopy === "code-block") {
      const { code, language } = codeBlock(node);
      return fenceCode(code, language);
    }
    if (component === "divider") return "\n---\n\n";
    if (component === "button")
      return `\nAction: ${cleanText(node.textContent) || attachmentLabel(node)}\n\n`;
    if (
      component === "popover-trigger" ||
      (component === "pressable" && node.getAttribute("role") === "link")
    ) {
      const label = richLabel(node);
      const url = node.dataset.aiscraperUrl || node.getAttribute("href");
      const citation = node.querySelector('[data-d-component="badge"]');
      const additional = citation && label.match(/\+(\d+)$/)?.[1];
      const text = additional
        ? `${label.replace(/\+\d+$/, "").trim()} (+${additional} more sources)`
        : label;
      const sources = JSON.parse(node.dataset.aiscraperSources || "[]");
      const details = sources.length
        ? ` [Sources: ${sources.map(({ label, url }) => (url ? `[${label}](${url})` : label)).join("; ")}]`
        : "";
      if (url) return `[${text}](${url})${details}`;
      return `${text} (${citation ? "source" : "link"}: target not exposed)${details}`;
    }
    if (tag === "img" || node.getAttribute("role") === "img") {
      const label =
        node.getAttribute("alt") || attachmentLabel(node) || "Image";
      const url = node.getAttribute("src");
      return url ? `![${label}](${url})` : `[${label}]`;
    }
    const formula = node.querySelector(
      'annotation[encoding="application/x-tex"]',
    );
    if (
      formula &&
      (component === "math" ||
        node.matches(".katex, .katex-display") ||
        tag === "math")
    ) {
      const display =
        node.hasAttribute("data-d-block") ||
        node.matches(".katex-display") ||
        node.getAttribute("display") === "block";
      return display
        ? `\n$$\n${formula.textContent}\n$$\n\n`
        : `$${formula.textContent}$`;
    }
    if (tag === "iframe" || tag === "canvas")
      return `\nEmbedded ${tag === "canvas" ? "chart/visual" : "content"}: ${attachmentLabel(node) || node.getAttribute("src") || "content not exposed in the DOM"}\n\n`;
    if (metricNode(node)) {
      const [label, value] = Array.from(node.children).map((child) =>
        cleanText(child.textContent),
      );
      return `* ${label}: **${value}**\n\n`;
    }
    if (component === "row" && !node.hasAttribute("data-d-inline")) {
      return `${Array.from(node.children)
        .map((child) => parseNode(child).trim())
        .filter(Boolean)
        .join(" — ")}\n\n`;
    }
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
    if (node.hasAttribute("data-d-default-strong"))
      return `**${parseChildren(node)}**`;
    if (node.dataset?.dFontStyle === "italic")
      return `*${parseChildren(node)}*`;
    if (tag === "strong" || tag === "b") return `**${parseChildren(node)}**`;
    if (tag === "em" || tag === "i") return `*${parseChildren(node)}*`;
    if (tag === "a") return parseLink(node);
    if (
      /^h[1-6]$/.test(tag) &&
      component === "title" &&
      node.closest('[data-d-component="card"]') &&
      node.previousElementSibling?.tagName === "P"
    )
      return `**${parseChildren(node).trim()}**\n\n`;
    if (/^h[1-6]$/.test(tag))
      return `${"#".repeat(Number(tag[1]))} ${parseChildren(node).trim()}\n\n`;
    if (tag === "li") {
      const parent = node.parentElement;
      const marker =
        parent?.tagName?.toLowerCase() === "ol"
          ? `${Number(parent.getAttribute("start") || 1) + Array.from(parent.children).indexOf(node)}. `
          : "* ";
      const content = parseChildren(node).trim().replace(/\n/g, "\n  ");
      return `${marker}${content}\n`;
    }
    if (tag === "ul" || tag === "ol") return `${parseChildren(node)}\n`;
    if (tag === "blockquote")
      return `> ${parseChildren(node).trim().replace(/\n/g, "\n> ")}\n\n`;
    const content = parseChildren(node);
    return tag === "p" ||
      (component &&
        !node.hasAttribute("data-d-inline") &&
        !["text", "code", "title"].includes(component))
      ? `${content.trim()}\n\n`
      : content;
  }

  // These large headings are values in cards, not document section headings.
  const metricNode = (node) =>
    ["box", "grid-item", "row"].includes(node.dataset?.dComponent) &&
    node.children.length === 2 &&
    node.children[0].tagName === "P" &&
    /^H[1-6]$/.test(node.children[1].tagName);

  const isChart = (node) =>
    node.tagName === "SECTION" &&
    Boolean(node.querySelector('[data-w-component="chart"]'));
  const richLabel = (node) =>
    cleanText(node.textContent) ||
    attachmentLabel(node) ||
    attachmentLabel(node.querySelector("[aria-label]")) ||
    "Source";

  function codeBlock(node) {
    const editor = node.querySelector('[role="textbox"][data-language]');
    const code = editor
      ? Array.from(editor.children, (line) =>
          textWithBreaks(line).replace(/\n$/, ""),
        ).join("\n")
      : textWithBreaks(node.querySelector("pre code, code") || node);
    const language =
      editor?.getAttribute("data-language") ||
      cleanText(
        node.querySelector('[data-markdown-copy="exclude"]')?.textContent,
      );
    return { code, language: language.toLowerCase() };
  }

  function messageParts(node) {
    if (node.nodeType === nodeTypes.TEXT_NODE) {
      const content = textNodeMarkdown(node);
      return content.trim() ? [{ type: "text", content }] : [];
    }
    if (node.nodeType !== nodeTypes.ELEMENT_NODE || isHidden(node)) return [];
    const content = parseNode(node).trim();
    if (!content) return [];
    const component = node.dataset?.dComponent;
    const tag = node.tagName.toLowerCase();
    const children = () => Array.from(node.childNodes).flatMap(messageParts);
    if (node.dataset?.aiscraperPart)
      return [JSON.parse(node.dataset.aiscraperPart)];
    if (node.dataset?.aiscraperMarkdown) return [{ type: "text", content }];
    if (metricNode(node))
      return [
        {
          type: "metric",
          label: cleanText(node.children[0].textContent),
          value: cleanText(node.children[1].textContent),
        },
      ];
    if (
      component === "popover-trigger" ||
      (component === "pressable" && node.getAttribute("role") === "link")
    ) {
      const citation = Boolean(
        node.querySelector('[data-d-component="badge"]'),
      );
      const visibleLabel = richLabel(node);
      const url = node.dataset.aiscraperUrl || node.getAttribute("href");
      const additionalSources = citation
        ? Number(visibleLabel.match(/\+(\d+)$/)?.[1] || 0)
        : 0;
      const label = additionalSources
        ? visibleLabel.replace(/\+\d+$/, "").trim()
        : visibleLabel;
      const file = component === "pressable" && /^Download\b/i.test(label);
      const name = file && label.match(/^Download\s+(.+\.[\w-]+)$/i)?.[1];
      const sources =
        node.dataset.aiscraperSources &&
        JSON.parse(node.dataset.aiscraperSources);
      return [
        {
          type: citation ? "citation" : file ? "file" : "link",
          label,
          ...(name && { name }),
          ...(additionalSources && { additionalSources }),
          ...(sources && { sources }),
          ...(url ? { url } : { unresolved: true }),
        },
      ];
    }
    if (component === "button")
      return [
        {
          type: "action",
          label: cleanText(node.textContent) || attachmentLabel(node),
          ...(node.disabled && { disabled: true }),
        },
      ];
    if (tag === "img" || node.getAttribute("role") === "img")
      return [
        {
          type: "image",
          label: node.getAttribute("alt") || attachmentLabel(node) || "Image",
          ...(node.getAttribute("src")
            ? { url: node.getAttribute("src") }
            : { unavailable: true }),
        },
      ];
    if (tag === "table")
      return [
        {
          type: "table",
          rows: Array.from(node.querySelectorAll("tr"), (row) =>
            Array.from(row.children, (cell) => parseChildren(cell).trim()),
          ),
          content,
        },
      ];
    if (node.dataset?.markdownCopy === "code-block")
      return [{ type: "code", ...codeBlock(node) }];
    if (tag === "pre")
      return [
        {
          type: "code",
          language: content.match(/^`+([^\n]*)/)?.[1] || "",
          code: textWithBreaks(node.querySelector("code") || node),
        },
      ];
    if (tag === "iframe" || tag === "canvas")
      return [
        {
          type: "embed",
          kind: tag,
          label: attachmentLabel(node),
          ...(node.getAttribute("src") && { url: node.getAttribute("src") }),
          unavailable: true,
        },
      ];
    if (
      (component === "math" || node.matches(".katex-display, .katex, math")) &&
      node.querySelector('annotation[encoding="application/x-tex"]')
    )
      return [
        {
          type: "math",
          latex: node.querySelector('annotation[encoding="application/x-tex"]')
            .textContent,
          display: content.startsWith("$$"),
          content,
        },
      ];
    if (tag === "code")
      return [{ type: "inline_code", code: node.textContent }];
    if (/^h[1-6]$/.test(tag)) {
      if (
        component === "title" &&
        node.closest('[data-d-component="card"]') &&
        node.previousElementSibling?.tagName === "P"
      )
        return [
          {
            type: "metric",
            label: cleanText(node.previousElementSibling.textContent),
            value: cleanText(node.textContent),
          },
        ];
      return [
        {
          type: "heading",
          level: Number(tag[1]),
          content: parseChildren(node).trim(),
        },
      ];
    }
    if (tag === "p" || component === "caption")
      return [
        {
          type: component === "caption" ? "caption" : "paragraph",
          content,
          children: children(),
        },
      ];
    if (tag === "a")
      return [
        {
          type: "link",
          label: cleanText(node.textContent),
          url: node.getAttribute("href") || "#",
        },
      ];
    if (["ul", "ol", "li", "blockquote", "details", "summary"].includes(tag))
      return [
        {
          type: {
            ul: "list",
            ol: "list",
            li: "list-item",
            blockquote: "quote",
            details: "details",
            summary: "summary",
          }[tag],
          ...(tag === "ol" && {
            ordered: true,
            start: Number(node.getAttribute("start") || 1),
          }),
          content,
          children: children(),
        },
      ];
    if (component === "divider" || tag === "hr") return [{ type: "divider" }];
    if (component && !["text", "code", "title"].includes(component))
      return [{ type: "group", component, children: children() }];
    return children();
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
      node?.getAttribute?.("aria-label") || node?.getAttribute?.("title"),
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

  const referencesByNode = new WeakMap();
  const referencesByDocument = new WeakMap();
  function exposedReference(node, index) {
    const direct = node.getAttribute("href");
    const preview = node.ownerDocument.getElementById(
      node.getAttribute("aria-controls"),
    );
    const url =
      direct ||
      (preview?.getAttribute("role") === "dialog" &&
        Array.from(preview.querySelectorAll("[href], [aria-label]"))
          .map(
            (element) =>
              element.getAttribute("href") ||
              element.getAttribute("aria-label"),
          )
          .find((value) => /^(?:https?:\/\/|sandbox:|\/)/.test(value || "")));
    const sources =
      preview?.getAttribute("role") === "dialog" &&
      node.querySelector('[data-d-component="badge"]')
        ? Array.from(
            preview.querySelectorAll('[data-d-component="pressable"]'),
            (card) => {
              const texts = topLevelMatches(
                Array.from(card.querySelectorAll('[data-d-component="text"]')),
              ).map((node) => cleanText(node.textContent));
              const label = texts.join(" — ") || richLabel(card);
              const url = card.getAttribute("href");
              return { label, ...(url ? { url } : { unresolved: true }) };
            },
          )
        : [];
    const label = richLabel(node);
    const message = node.closest(
      "[data-chatgpt-selection-message-id], [data-message-id], [data-chatgpt-search-message-ids]",
    );
    const id =
      message?.getAttribute("data-chatgpt-selection-message-id") ||
      message?.getAttribute("data-message-id") ||
      message
        ?.getAttribute("data-chatgpt-search-message-ids")
        ?.trim()
        .split(/\s+/)[0];
    if (!referencesByDocument.has(node.ownerDocument))
      referencesByDocument.set(node.ownerDocument, new Map());
    const cache = id
      ? referencesByDocument.get(node.ownerDocument)
      : referencesByNode;
    const key = id ? `${id}:${index}` : node;
    if (url || sources.length) cache.set(key, { url, sources, label });
    const cached = cache.get(key);
    return cached?.label === label ? cached : {};
  }

  function cloneForExtraction(message, role) {
    const content =
      role === "assistant"
        ? message.querySelector(".markdown") || message
        : message;
    const clone = content.cloneNode(true);
    // Resolve only this trigger's associated preview; never click links/actions or
    // infer a source URL from its favicon domain. Immutable IDs retain references
    // across virtualized remounts; labels guard against recycled controls.
    const linkSelector =
      '[data-d-component="popover-trigger"], [data-d-component="pressable"][role="link"]';
    const sourceLinks = Array.from(content.querySelectorAll(linkSelector));
    clone.querySelectorAll(linkSelector).forEach((node, index) => {
      const reference = exposedReference(sourceLinks[index], index);
      if (reference.url) node.dataset.aiscraperUrl = reference.url;
      if (reference.sources?.length)
        node.dataset.aiscraperSources = JSON.stringify(reference.sources);
    });
    // Chart values are deliberately duplicated in a screen-reader summary.
    // Capture that semantic data before removing UI-only accessibility labels.
    Array.from(clone.querySelectorAll("section"))
      .filter(isChart)
      .forEach((chart) => {
        const summary = Array.from(chart.querySelectorAll("li"), (item) =>
          cleanText(item.textContent),
        );
        const label = attachmentLabel(chart);
        const caption = Array.from(chart.querySelectorAll("p"), (node) =>
          cleanText(node.textContent),
        )
          .filter(Boolean)
          .join("\n");
        const markdown = `Chart: ${label}\n${summary.length ? summary.map((line) => `* ${line}`).join("\n") : "Chart data not exposed in the DOM."}${caption ? `\n${caption}` : ""}`;
        const replacement = clone.ownerDocument.createElement("div");
        replacement.dataset.aiscraperMarkdown = markdown;
        replacement.dataset.aiscraperPart = JSON.stringify({
          type: "chart",
          label,
          summary,
          ...(caption && { caption }),
          ...(summary.length === 0 && { unavailable: true }),
        });
        chart.replaceWith(replacement);
      });
    clone
      .querySelectorAll(
        '[data-d-component="checkbox"], li input[type="checkbox"]',
      )
      .forEach((checkbox) => {
        const label =
          Array.from(clone.querySelectorAll("label")).find(
            (label) => label.htmlFor === checkbox.id,
          ) ||
          checkbox.closest("label") ||
          checkbox.parentElement.querySelector("label");
        const text = cleanText(label?.textContent) || attachmentLabel(checkbox);
        const checked =
          checkbox.getAttribute("aria-checked") ?? String(checkbox.checked);
        const replacement = clone.ownerDocument.createElement("div");
        replacement.dataset.aiscraperMarkdown = `* [${checked === "true" ? "x" : checked === "mixed" ? "-" : " "}] ${text}`;
        replacement.dataset.aiscraperPart = JSON.stringify({
          type: "checkbox",
          label: text,
          checked: checked === "mixed" ? "mixed" : checked === "true",
        });
        checkbox.replaceWith(replacement);
        label?.remove();
      });
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
        button.dataset.dComponent === "button" &&
        !button.closest('[data-markdown-copy="exclude"]')
      )
        return;
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
    const scope = doc.querySelector("main") || doc;
    const legacyNodes = Array.from(
      scope.querySelectorAll(
        '[data-message-author-role="user"], [data-message-author-role="assistant"]',
      ),
    ).filter(
      (node) => !node.parentElement?.closest?.("[data-message-author-role]"),
    );
    const nodes = legacyNodes.length
      ? legacyNodes
      : Array.from(
          scope.querySelectorAll(
            '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]',
          ),
        ).filter((node) => !node.closest("[hidden], [aria-hidden='true']"));
    return nodes.flatMap((node, index) => {
      const role =
        node.getAttribute("data-message-author-role") ||
        (node.matches('[data-user-message-bubble="true"]')
          ? "user"
          : "assistant");
      const clone = cloneForExtraction(node, role);
      const content = parseChildren(clone).trim();
      const rich = clone.querySelector(
        '[data-d-component], [data-aiscraper-part], img, [role="img"], .katex, math, iframe, canvas',
      );
      const parts = rich
        ? Array.from(clone.childNodes).flatMap(messageParts)
        : [];
      if (!roleLabels[role] || !content) return [];
      const turn = node.closest(
        "[data-content-search-turn-key], section[data-testid^='conversation-turn-']",
      );
      const turnId = turn?.getAttribute("data-testid") || "";
      const messageIds = node
        .closest("[data-chatgpt-search-message-ids]")
        ?.getAttribute("data-chatgpt-search-message-ids")
        ?.trim()
        .split(/\s+/);
      const id =
        node.getAttribute("data-message-id") ||
        node
          .closest("[data-chatgpt-selection-message-id]")
          ?.getAttribute("data-chatgpt-selection-message-id") ||
        messageIds?.[0] ||
        node
          .closest("[data-content-search-unit-key]")
          ?.getAttribute("data-content-search-unit-key") ||
        turnId ||
        node.id ||
        `${role}-${index + 1}`;
      const order = Number(
        turnId.match(/conversation-turn-(\d+)/)?.[1] ?? index,
      );
      const timestamp = normalizeTimestamp(
        turn?.querySelector("time[datetime]")?.getAttribute("datetime"),
      );
      return [
        {
          id,
          role,
          content,
          ...(parts.length && { parts }),
          order: Number.isFinite(order) ? order : index,
          ...(timestamp && { timestamp }),
        },
      ];
    });
  }

  const publicMessage = ({ id, role, content, timestamp, parts }) => ({
    id,
    role,
    content,
    ...(parts && { parts }),
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
      '<div id="chatgptscraper-copy-controls" role="group" aria-label="Copy captured messages" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:12px system-ui,sans-serif;color-scheme:light"><button id="chatgptscraper-copy-markdown-btn" data-format="markdown" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-json-btn" data-format="json" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-prompts-btn" data-format="prompts" style="padding:6px 8px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgptscraper-copy-close-btn" type="button" aria-label="Close scraper controls" title="Close" data-action="close" style="padding:2px 10px;background:#dc3545;color:#fff;border:1px solid #dc3545;border-radius:5px;cursor:pointer"></button></div>',
    );
    const controls = doc.getElementById("chatgptscraper-copy-controls");
    doc.getElementById("chatgptscraper-copy-close-btn").textContent = "×";
    const feedbackTimers = new Map();
    controls.addEventListener("click", async (event) => {
      const button = event.target.closest?.("button[data-format]");
      if (button) {
        doc.defaultView.clearTimeout(feedbackTimers.get(button));
        button.disabled = true;
        let copied = false;
        try { copied = await onCopy(button.dataset.format, button); } catch {}
        button.disabled = false;
        button.textContent = copied ? "Copied" : "Copy failed";
        button.style.background = copied ? "#198754" : "#dc3545";
        button.style.borderColor = button.style.background;
        button.dataset.feedback = "true";
        feedbackTimers.set(button, doc.defaultView.setTimeout(() => {
          button.textContent = button.dataset.copyLabel;
          button.style.background = button.dataset.copyBackground;
          button.style.borderColor = button.dataset.copyBorder;
          delete button.dataset.feedback;
        }, 3000));
      }
      if (event.target.closest?.("button[data-action='close']")) {
        for (const timer of feedbackTimers.values()) doc.defaultView.clearTimeout(timer);
        controls.remove();
      }
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
          const button = doc.getElementById(`chatgptscraper-copy-${format}-btn`);
          button.dataset.copyLabel = `Copy ${amount} ${label === "prompts" ? label : `messages as ${label}`}`;
          button.dataset.copyBackground ||= button.style.background;
          button.dataset.copyBorder ||= button.style.borderColor;
          if (!button.dataset.feedback) button.textContent = button.dataset.copyLabel;
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
    const controls = mountCopyControls(doc, async (format) => {
      await state.timestampsPromise;
      captureMessages(doc, state);
      const payload =
        format === "markdown"
          ? messagesToMarkdown(state.messages, state.metadata)
          : format === "prompts"
            ? messagesToPrompts(state.messages, state.metadata)
            : JSON.stringify(state.messages, null, 2);
      const copied = await copyText(payload, doc, nav);
      if (!copied)
        (win?.alert ?? console.warn)("Failed to copy ChatGPT conversation.");
      if (state.active) controls.updateCount(state.messages.length, state.messages.filter(({ role }) => role === "user").length);
      return copied;
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
