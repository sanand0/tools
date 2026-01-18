(function () {
  const $ = (selector, el = document) => el.querySelector(selector);

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
    // 1. Handle Text
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    // 2. Handle Elements
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      // --- Code Blocks ---
      // Gemini wraps code in a custom <code-block> element
      if (tag === "code-block") {
        const lang = node.querySelector(".code-block-decoration span")?.textContent || "";
        // Get raw text from the code container to preserve whitespace/indentation
        const code = node.querySelector(".code-container")?.textContent || "";
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
      }

      // --- Formatting ---
      if (tag === "b" || tag === "strong") return `**${parseChildren(node)}**`;
      if (tag === "i" || tag === "em") return `*${parseChildren(node)}*`;
      if (tag === "code") return `\`${node.textContent}\``; // Inline code
      if (tag === "a") return `[${node.textContent}](${node.getAttribute("href") || "#"})`;

      // --- Structure ---
      if (tag === "p") {
        // If inside a list item to avoid double newlines
        const inList = node.closest("li");
        return `${parseChildren(node)}${inList ? "\n" : "\n\n"}`;
      }
      if (tag === "br") return `\n`;
      if (tag.match(/^h[1-6]$/)) {
        const level = "#".repeat(parseInt(tag[1]));
        return `${level} ${parseChildren(node)}\n\n`;
      }
      if (tag === "hr") return `\n---\n\n`;

      // --- Lists ---
      if (tag === "li") {
        const parent = node.parentElement;
        const index = Array.from(parent.children).indexOf(node) + 1;
        const marker = parent.tagName.toLowerCase() === "ol" ? `${index}. ` : "* ";

        // Calculate indent based on parent li's marker length for proper nesting
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

      // --- Container Fallback ---
      // Recurse for divs, spans, or custom tags like <response-element>
      return parseChildren(node);
    }
    return "";
  }

  function parseChildren(node) {
    return Array.from(node.childNodes).map(parseGeminiNode).join("");
  }

  // --- Main Extraction ---
  const title = $(".conversation-title-container .conversation-title")?.textContent?.trim() || "Gemini Conversation";
  const date = formatLocalIso(new Date());
  const source = location.href;
  const conversations = document.querySelectorAll(".conversation-container");
  let mdOutput = `---\ntitle: "${yamlEscape(title)}"\ndate: ${date}\nsource: "${yamlEscape(source)}"\n---\n\n`;

  conversations.forEach((conv) => {
    // 1. User Query
    const userNode = conv.querySelector("user-query .query-text");
    if (userNode) {
      mdOutput += `## User\n\n${userNode.innerText.trim()}\n\n`;
    }

    // 2. Model Response
    // We select ALL markdown containers. This captures 'Thinking' and 'Final Response'.
    const markdownNodes = conv.querySelectorAll("model-response .markdown");

    if (markdownNodes.length > 0) {
      mdOutput += `## Gemini\n\n`;

      markdownNodes.forEach((node) => {
        // Check if this markdown node is inside the "Thoughts" section
        const isThought = node.closest("model-thoughts");

        let content = parseGeminiNode(node).trim();

        if (content.length > 0) {
          if (isThought) {
            mdOutput += `> **Thinking:**\n> ${content.replace(/\n/g, "\n> ")}\n\n`;
          } else {
            mdOutput += `${content}\n\n`;
          }
        }
      });

      mdOutput += `---\n\n`;
    }
  });

  // --- Copy ---
  copy(mdOutput);
})();
