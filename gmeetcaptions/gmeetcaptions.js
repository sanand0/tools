// @ts-check
(function (root) {
  const SELECTORS = {
    region: '[role="region"][aria-label="Captions"]',
    item: ".nMcdL",
    speaker: ".NWpY1d",
    text: ".ygicle",
  };

  const normalize = (text = "") => String(text).replace(/\s+/g, " ").trim();
  const escapeMarkdown = (text = "") =>
    normalize(text)
      .replace(/\\/g, "\\\\")
      .replace(/([`*_[\]])/g, "\\$1");

  function getRegion(doc = root.document) {
    return (
      doc.querySelector(SELECTORS.region) ||
      [...doc.querySelectorAll('[role="region"][aria-label], [aria-label="Captions"]')].find(
        (node) => normalize(node.getAttribute?.("aria-label")) === "Captions",
      ) ||
      null
    );
  }

  function readTurn(item) {
    const speaker = normalize(item?.querySelector(SELECTORS.speaker)?.textContent || "");
    const text = normalize(item?.querySelector(SELECTORS.text)?.textContent || "");
    if (!speaker || !text) return null;
    return {
      speaker: escapeMarkdown(speaker),
      text: escapeMarkdown(text),
    };
  }

  function rawTurns(doc = root.document) {
    const region = getRegion(doc);
    if (!region) return [];

    const items = [...region.querySelectorAll(SELECTORS.item)];
    if (items.length > 0) return items.map(readTurn).filter(Boolean);

    return [...region.querySelectorAll(SELECTORS.text)]
      .map((textNode) => readTurn(textNode.closest("div")))
      .filter(Boolean);
  }

  function mergeTurns(turns) {
    return turns.reduce((out, turn) => {
      const previous = out.at(-1);
      if (!previous || previous.speaker !== turn.speaker) {
        out.push({ ...turn });
        return out;
      }
      if (turn.text === previous.text || previous.text.endsWith(turn.text)) return out;
      if (turn.text.startsWith(previous.text)) {
        previous.text = turn.text;
        return out;
      }
      previous.text = `${previous.text}\n\n${turn.text}`;
      return out;
    }, []);
  }

  function renderMarkdown(turns) {
    if (turns.length === 0) return "";
    return ["# Google Meet Captions", "", ...turns.flatMap(({ speaker, text }) => [`## ${speaker}`, "", text, ""])]
      .join("\n")
      .trim();
  }

  function extractCaptions(doc = root.document) {
    return renderMarkdown(mergeTurns(rawTurns(doc)));
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
      const copied = doc.execCommand?.("copy");
      textarea.remove();
      return Boolean(copied);
    }
  }

  async function copyCaptions(doc = root.document, win = root, nav = root.navigator) {
    const markdown = extractCaptions(doc);
    const notify = win?.alert ?? console.warn;
    if (!markdown) {
      notify("No Google Meet captions found.");
      return "";
    }
    const ok = await copyText(markdown, doc, nav);
    notify(ok ? "Google Meet captions copied to clipboard as Markdown." : "Failed to copy Google Meet captions.");
    return markdown;
  }

  root.gmeetcaptions = {
    extractCaptions,
    copyCaptions,
    scrape: copyCaptions,
  };
})(typeof window === "undefined" ? globalThis : window);
