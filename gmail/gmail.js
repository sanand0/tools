// @ts-check

(() => {
  const subjectFromTitle = (title) => {
    const parts = title.split(" - ").map((part) => part.trim());
    if (parts.at(-1)?.toLowerCase() === "gmail") parts.pop();
    if (parts.length > 1) parts.pop();
    return parts.join(" - ");
  };

  const findSenders = (root) => {
    const senders = [...root.querySelectorAll('[role="listitem"][aria-expanded="true"]')].flatMap((message) => {
      const sender = message.querySelector("[email][name]") || message.querySelector("[email]");
      const email = sender?.getAttribute("email")?.trim();
      if (!email) return [];
      const name = sender.getAttribute("name")?.trim() || sender.textContent?.trim() || email;
      return [{ name, email }];
    });
    if (!senders.length) throw new Error("Open an email in GMail first.");
    return senders;
  };

  const extractHeader = (root = document) => {
    const fromLines = findSenders(root).map(({ name, email }) => `From: ${name} <${email}>`);
    return [`Subject: ${subjectFromTitle(root.title)}`, ...fromLines].join("\n");
  };

  const showCopiedNotification = (root, win) => {
    root.querySelector("[data-gmail-notification]")?.remove();
    const notification = root.createElement("div");
    notification.dataset.gmailNotification = "";
    notification.setAttribute("role", "status");
    notification.setAttribute("aria-live", "polite");
    notification.style.cssText =
      "position:fixed;left:24px;bottom:24px;z-index:2147483647;padding:12px 20px;border-radius:4px;background:#202124;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font:14px/20px system-ui,sans-serif";
    notification.textContent = "GMail header copied.";
    root.body.append(notification);
    win.setTimeout(() => notification.remove(), 5000);
  };

  const copyHeader = async (root = document, win = window, nav = navigator) => {
    try {
      await nav.clipboard.writeText(extractHeader(root));
      showCopiedNotification(root, win);
    } catch (error) {
      win.alert(error instanceof Error ? error.message : "Unable to copy the GMail header.");
    }
  };

  window.gmail = { extractHeader, copyHeader };
})();
