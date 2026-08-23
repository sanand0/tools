(function (root) {
  const BLOCK_SELECTOR =
    "address,article,aside,blockquote,dd,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,td,th,ul";

  function normalizeText(text) {
    return text.replace(/[\s\u00a0]+/g, " ").trim();
  }

  function encodeFragmentTerm(text) {
    return encodeURIComponent(text).replace(/-/g, "%2D");
  }

  function blockFor(node, doc) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element?.closest?.(BLOCK_SELECTOR) || doc.body;
  }

  function textBetween(doc, container, start, end) {
    const range = doc.createRange();
    range.selectNodeContents(container);
    if (start) range.setStart(start.node, start.offset);
    if (end) range.setEnd(end.node, end.offset);
    return normalizeText(range.toString());
  }

  function trimTerm(text, fromEnd = false) {
    if (text.length <= 120) return text;
    if (fromEnd) {
      const excerpt = text.slice(-120);
      const boundary = excerpt.search(/\s/);
      return boundary < 0 ? excerpt : excerpt.slice(boundary + 1);
    }
    const excerpt = text.slice(0, 121);
    const boundary = excerpt.lastIndexOf(" ");
    return boundary < 0 ? excerpt.slice(0, 120) : excerpt.slice(0, boundary);
  }

  function contextTerm(text, fromEnd = false) {
    const words = normalizeText(text).split(" ").filter(Boolean);
    return (fromEnd ? words.slice(-3) : words.slice(0, 3)).join(" ");
  }

  function countMatches(text, query) {
    let count = 0;
    let offset = 0;
    const haystack = text.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    while ((offset = haystack.indexOf(needle, offset)) >= 0) {
      count += 1;
      offset += Math.max(needle.length, 1);
    }
    return count;
  }

  function expandToWordBoundaries(range) {
    const expanded = range.cloneRange();
    const isWord = (character) => /[\p{L}\p{M}\p{N}_]/u.test(character || "");
    if (expanded.startContainer.nodeType === 3) {
      const text = expanded.startContainer.data;
      let offset = expanded.startOffset;
      while (offset > 0 && isWord(text[offset - 1]) && isWord(text[offset]))
        offset -= 1;
      expanded.setStart(expanded.startContainer, offset);
    }
    if (expanded.endContainer.nodeType === 3) {
      const text = expanded.endContainer.data;
      let offset = expanded.endOffset;
      while (
        offset < text.length &&
        isWord(text[offset - 1]) &&
        isWord(text[offset])
      )
        offset += 1;
      expanded.setEnd(expanded.endContainer, offset);
    }
    return expanded;
  }

  function baseUrlForSelection(url, doc, range) {
    const parsed = new URL(url);
    const fragmentId = decodeURIComponent(parsed.hash.slice(1).split(":~:")[0]);
    parsed.hash = "";
    if (!fragmentId) return `${parsed.href}#`;
    const fallback = doc.getElementById(fragmentId);
    const startElement =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
    const endElement =
      range.endContainer.nodeType === 1
        ? range.endContainer
        : range.endContainer.parentElement;
    return fallback?.contains(startElement) && fallback.contains(endElement)
      ? `${parsed.href}#${encodeURIComponent(fragmentId)}`
      : `${parsed.href}#`;
  }

  function buildTextFragmentUrl(
    doc = root.document,
    win = root,
    url = win.location.href,
  ) {
    const selection = win.getSelection?.();
    const selectedText = normalizeText(selection?.toString?.() || "");
    if (!selection?.rangeCount || selection.isCollapsed || !selectedText)
      return url;

    const range = expandToWordBoundaries(selection.getRangeAt(0));
    const expandedText = normalizeText(range.toString());
    const startBlock = blockFor(range.startContainer, doc);
    const endBlock = blockFor(range.endContainer, doc);
    const sameBlock = startBlock === endBlock;
    const terms = [];

    if (sameBlock && expandedText.length <= 300) {
      terms.push(expandedText);
    } else {
      const startText = textBetween(
        doc,
        startBlock,
        { node: range.startContainer, offset: range.startOffset },
        sameBlock
          ? { node: range.endContainer, offset: range.endOffset }
          : null,
      );
      const endText = textBetween(
        doc,
        endBlock,
        sameBlock
          ? { node: range.startContainer, offset: range.startOffset }
          : null,
        { node: range.endContainer, offset: range.endOffset },
      );
      terms.push(trimTerm(startText), trimTerm(endText, true));
    }

    const pageText = normalizeText(
      doc.body?.innerText || doc.body?.textContent || "",
    );
    const needsContext =
      expandedText.split(" ").length <= 3 ||
      countMatches(pageText, expandedText) > 1;
    let prefix = "";
    let suffix = "";
    if (needsContext) {
      prefix = contextTerm(
        textBetween(doc, startBlock, null, {
          node: range.startContainer,
          offset: range.startOffset,
        }),
        true,
      );
      suffix = contextTerm(
        textBetween(
          doc,
          endBlock,
          { node: range.endContainer, offset: range.endOffset },
          null,
        ),
      );
    }

    const directive = [
      prefix ? `${encodeFragmentTerm(prefix)}-,` : "",
      terms.map(encodeFragmentTerm).join(","),
      suffix ? `,-${encodeFragmentTerm(suffix)}` : "",
    ].join("");
    return `${baseUrlForSelection(url, doc, range)}:~:text=${directive}`;
  }

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
        desc = (desc + "")
          .replace(/[\r\n\t]+/g, " ")
          .trim()
          .substring(0, 200);

        return `${url}\t${desc}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  async function copyText(text, doc = root.document, nav = root.navigator) {
    try {
      if (!nav?.clipboard?.writeText)
        throw new Error("Clipboard API unavailable");
      await nav.clipboard.writeText(text);
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

  async function copyLinks(
    doc = root.document,
    win = root,
    nav = root.navigator,
  ) {
    const output = collectLinks(doc);
    const ok = await copyText(output, doc, nav);
    const notify = win?.alert ?? console.warn;
    notify(
      ok ? "Links copied to clipboard." : "Failed to copy links to clipboard.",
    );
    return output;
  }

  async function scrape(doc = root.document, win = root, nav = root.navigator) {
    return copyLinks(doc, win, nav);
  }

  async function copyTextFragment(
    doc = root.document,
    win = root,
    nav = root.navigator,
  ) {
    const output = buildTextFragmentUrl(doc, win);
    const ok = await copyText(output, doc, nav);
    const notify = win?.alert ?? console.warn;
    notify(
      ok ? "URL copied to clipboard." : "Failed to copy URL to clipboard.",
    );
    return output;
  }

  root.copylinks = {
    buildTextFragmentUrl,
    collectLinks,
    copyLinks,
    copyTextFragment,
    scrape,
  };
})(typeof window === "undefined" ? globalThis : window);
