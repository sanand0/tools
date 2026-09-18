// @ts-check
(function (root) {
  const cleanText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const conversationId = (url) =>
    new URL(url).pathname.match(/\/c\/([^/]+)/)?.[1];

  function extractChats(doc = root.document) {
    const history = doc.querySelector('nav[aria-label="Chat history"]');
    if (!history) return [];
    return Array.from(history.querySelectorAll('a[href*="/c/"]')).flatMap(
      (link) => {
        const url = new URL(link.getAttribute("href"), doc.location?.href).href;
        const title = cleanText(
          link.querySelector("[data-marquee-text]")?.textContent ||
            link.textContent ||
            link.getAttribute("aria-label"),
        );
        return conversationId(url) && title ? [{ title, url }] : [];
      },
    );
  }

  function createScraperState() {
    return {
      chatsById: new Map(),
      chatIds: [],
      chats: [],
      captureTimer: null,
    };
  }

  function captureChats(doc, state) {
    extractChats(doc).forEach((chat) => {
      const id = conversationId(chat.url);
      if (!state.chatsById.has(id)) state.chatIds.push(id);
      state.chatsById.set(id, chat);
    });
    state.chats = state.chatIds.map((id) => state.chatsById.get(id));
    return state.chats;
  }

  const escapeMarkdown = (value) => value.replace(/([\\[\]])/g, "\\$1");
  const chatsToMarkdown = (chats) =>
    chats
      .map(({ title, url }) => `- [${escapeMarkdown(title)}](${url})`)
      .join("\n");

  async function copyText(text, doc = root.document, nav = root.navigator) {
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to execCommand for bookmarklet contexts without permission.
      }
    }
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    doc.body.appendChild(textarea);
    textarea.select();
    const copied = doc.execCommand?.("copy");
    textarea.remove();
    return Boolean(copied);
  }

  function mountCopyControls(doc, onCopy) {
    doc.getElementById("chatgpt-sidebar-scraper-copy-controls")?.remove();
    doc.body.insertAdjacentHTML(
      "beforeend",
      '<div id="chatgpt-sidebar-scraper-copy-controls" role="group" aria-label="Copy captured chats" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:14px system-ui,sans-serif;color-scheme:light"><button id="chatgpt-sidebar-scraper-copy-markdown-btn" data-format="markdown" style="padding:8px 10px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer"></button><button id="chatgpt-sidebar-scraper-copy-json-btn" data-format="json" style="padding:8px 10px;background:#fff;color:#111;border:1px solid #777;border-radius:5px;cursor:pointer"></button></div>',
    );
    const controls = doc.getElementById(
      "chatgpt-sidebar-scraper-copy-controls",
    );
    controls.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-format]");
      if (button) onCopy(button.dataset.format, button);
    });
    return {
      remove: () => controls.remove(),
      updateCount(count) {
        for (const format of ["markdown", "json"]) {
          doc.getElementById(
            `chatgpt-sidebar-scraper-copy-${format}-btn`,
          ).textContent =
            `Copy ${count} chats as ${format === "json" ? "JSON" : "Markdown"}`;
        }
      },
    };
  }

  function scrape(
    doc = root.document,
    win = root,
    nav = root.navigator,
    state = createScraperState(),
    setIntervalFn = win.setInterval.bind(win),
    clearIntervalFn = win.clearInterval.bind(win),
  ) {
    const previousState = root.__chatgptSidebarScraperState;
    if (previousState?.captureTimer)
      clearIntervalFn(previousState.captureTimer);
    const controls = mountCopyControls(doc, async (format, button) => {
      clearIntervalFn(state.captureTimer);
      state.captureTimer = null;
      button.disabled = true;
      button.textContent = "Copying…";
      captureChats(doc, state);
      const payload =
        format === "markdown"
          ? chatsToMarkdown(state.chats)
          : JSON.stringify(state.chats, null, 2);
      controls.remove();
      if (!(await copyText(payload, doc, nav)))
        (win?.alert ?? console.warn)("Failed to copy ChatGPT chats.");
    });
    const update = () => controls.updateCount(captureChats(doc, state).length);
    update();
    state.captureTimer = setIntervalFn(update, 500);
    root.__chatgptSidebarScraperState = state;
    return state;
  }

  root.chatgptSidebarScraper = {
    captureChats,
    chatsToMarkdown,
    createScraperState,
    extractChats,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
