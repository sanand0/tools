(function (root) {
  function collectLinks(doc = root.document) {
    const selectors =
      "a[href], img[src], iframe[src], script[src], link[href], video[src], audio[src], source[src]";
    const elements = doc.querySelectorAll(selectors);
    const seen = new Set();

    return Array.from(elements)
      .map((el) => {
        const url = el.href || el.src;
        if (!url || seen.has(url)) return null;
        seen.add(url);

        let desc = el.innerText || el.alt || el.title || el.rel || el.tagName;
        desc = (desc + "").replace(/[\r\n\t]+/g, " ").trim().substring(0, 200);

        return `${url}\t${desc}`;
      })
      .filter(Boolean)
      .join("\n");
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

  async function copyLinks(doc = root.document, win = root, nav = root.navigator) {
    const output = collectLinks(doc);
    const ok = await copyText(output, doc, nav);
    const notify = win?.alert ?? console.warn;
    notify(ok ? "Links copied to clipboard." : "Failed to copy links to clipboard.");
    return output;
  }

  async function scrape(doc = root.document, win = root, nav = root.navigator) {
    return copyLinks(doc, win, nav);
  }

  root.copylinks = {
    collectLinks,
    copyLinks,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
