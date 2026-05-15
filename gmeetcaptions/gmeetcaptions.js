// @ts-check
(function (root) {
  const SELECTORS = {
    region: '[role="region"][aria-label="Captions"]',
    item: ".nMcdL",
    speaker: ".NWpY1d",
    text: ".ygicle",
    timer: '[jsname="W5i7Bf"]',
    moreOptions: '[aria-label^="More options for "]',
  };
  const PANEL_ID = "gmeetcaptions-panel";
  const STATE_KEY = "__gmeetcaptionsState";
  const STABILITY_POLLS = 4; // finalize after this many 1s polls with unchanged text
  // Structural avatar selector: Meet attaches data-iml (image-metric-latency) to caption avatars
  const AVATAR_SEL = 'img[data-iml], img[src*="googleusercontent.com"]';

  // === Utils ===
  const normalize = (text = "") => String(text).replace(/\s+/g, " ").trim();
  const escapeMarkdown = (text = "") =>
    normalize(text)
      .replace(/\\/g, "\\\\")
      .replace(/([`*_[\]])/g, "\\$1");
  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };
  const findLast = (arr, pred) => {
    for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return arr[i];
  };

  // === Region ===
  function getRegion(doc = root.document) {
    return (
      doc.querySelector(SELECTORS.region) ||
      [...doc.querySelectorAll('[role="region"][aria-label], [aria-label="Captions"]')].find(
        (node) => normalize(node.getAttribute?.("aria-label")) === "Captions",
      ) ||
      null
    );
  }

  // === Structural caption helpers (fallbacks when class names change) ===
  // Caption items are direct children of the region that contain a Meet avatar img.
  function isItem(node) {
    return node.nodeType === 1 && (node.matches?.(SELECTORS.item) || !!node.querySelector?.(AVATAR_SEL));
  }

  // Walk up from a DOM node to find its enclosing caption item.
  function closestItem(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el) {
      if (isItem(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Return all caption items inside a region.
  function getItems(region) {
    const byClass = [...region.querySelectorAll(SELECTORS.item)];
    if (byClass.length) return byClass;
    // Structural fallback: direct children that contain a Meet avatar img
    return [...region.children].filter((el) => el.querySelector(AVATAR_SEL));
  }

  // Extract the speaker name element from a caption item.
  function getSpeakerEl(item) {
    return (
      item.querySelector(SELECTORS.speaker) ||
      item.querySelector("span") // speaker name is always the only span in an item
    );
  }

  // Extract the caption text element from a caption item.
  function getTextEl(item) {
    return (
      item.querySelector(SELECTORS.text) ||
      // Structural fallback: last div child that doesn't contain an avatar img
      findLast([...item.children], (el) => el.tagName === "DIV" && !el.querySelector(AVATAR_SEL))
    );
  }

  // === Caption reading ===
  function readTurn(item) {
    const speaker = normalize(getSpeakerEl(item)?.textContent || "");
    const text = normalize(getTextEl(item)?.textContent || "");
    if (!speaker || !text) return null;
    return { speaker: escapeMarkdown(speaker), text: escapeMarkdown(text) };
  }

  function rawTurns(doc = root.document) {
    const region = getRegion(doc);
    if (!region) return [];
    const items = getItems(region);
    if (items.length > 0) return items.map(readTurn).filter(Boolean);
    return [...region.querySelectorAll(SELECTORS.text)].map((n) => readTurn(n.closest("div"))).filter(Boolean);
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

  // === Metadata ===
  function getMeta(doc = root.document, win = root) {
    const title = normalize(
      doc.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title") ||
        doc.title.replace(/^Meet\s*[-–]\s*/, ""),
    );
    const code = (win.location?.pathname || "").replace(/^\//, "");
    const duration = doc.querySelector(SELECTORS.timer)?.textContent?.trim() || "";
    const participants = [...doc.querySelectorAll(SELECTORS.moreOptions)]
      .map((b) =>
        b
          .getAttribute("aria-label")
          ?.replace(/^More options for\s+/, "")
          .trim(),
      )
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return { title, code, duration, participants };
  }

  // === Clipboard ===
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

  // === Streaming ===
  function getStreamState() {
    return root[STATE_KEY] || null;
  }

  function trackItem(el, state) {
    if (state.seenItems.has(el)) return;
    const turn = readTurn(el);
    if (!turn) return;
    state.seenItems.set(el, { ...turn, firstSeenAt: Date.now(), stalePollCount: 0, finalized: false });
  }

  function refreshItem(el, state) {
    const entry = state.seenItems.get(el);
    if (!entry) return;
    const turn = readTurn(el);
    if (!turn) return;
    if (entry.text !== turn.text) {
      if (entry.finalized) entry.finalized = false; // will overwrite in-place; keep original timestamp
      entry.text = turn.text;
      entry.stalePollCount = 0;
    } else if (!entry.finalized) {
      entry.stalePollCount++;
    }
  }

  async function writeItem(entry, state) {
    if (entry.finalized) return;
    const elapsed = formatDuration(entry.firstSeenAt - state.startedAt);
    const content = `\n## ${entry.speaker} [${elapsed}]\n\n${entry.text}\n`;
    const bytes = new TextEncoder().encode(content).length;
    try {
      if (entry.filePosition !== undefined && entry.filePosition + entry.fileLength === state.filePosition) {
        // Overwrite the last-written entry in-place so growing turns don't duplicate
        await state.writable.seek(entry.filePosition);
        await state.writable.write(content);
        await state.writable.truncate(entry.filePosition + bytes);
        state.filePosition = entry.filePosition + bytes;
      } else {
        entry.filePosition = state.filePosition;
        await state.writable.write(content);
        state.filePosition += bytes;
        state.savedCount++;
      }
      entry.fileLength = bytes;
    } catch {}
    entry.finalized = true;
  }

  async function startStreaming(doc = root.document, win = root) {
    if (getStreamState()?.running) return;
    if (typeof win.showSaveFilePicker !== "function") {
      (win.alert ?? console.warn)("File saving is not supported in this browser.");
      return;
    }

    const meta = getMeta(doc, win);
    let writable;
    try {
      const fileHandle = await win.showSaveFilePicker({
        suggestedName: `meet-${meta.code || "captions"}-${new Date().toISOString().slice(0, 10)}.md`,
        types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      });
      writable = await fileHandle.createWritable();
    } catch (e) {
      if (e?.name !== "AbortError") console.error("gmeetcaptions:", e);
      return;
    }

    const startedAt = Date.now();
    const header = [
      `# ${escapeMarkdown(meta.title || "Google Meet")}`,
      "",
      `- **Meeting code**: ${meta.code}`,
      `- **Started**: ${new Date(startedAt).toLocaleString()}`,
      meta.participants.length ? `- **Participants**: ${meta.participants.map(escapeMarkdown).join(", ")}` : "",
      "",
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await writable.write(header);
    const filePosition = new TextEncoder().encode(header).length;

    const state = {
      running: true,
      writable,
      startedAt,
      filePosition,
      seenItems: new Map(),
      observer: null,
      stabilityTimer: null,
      savedCount: 0,
    };
    root[STATE_KEY] = state;

    const region = getRegion(doc);
    if (region) {
      getItems(region).forEach((el) => trackItem(el, state));

      state.observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
          for (const node of mut.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (isItem(node)) trackItem(node, state);
            else node.querySelectorAll?.(SELECTORS.item)?.forEach((n) => trackItem(n, state));
          }
          for (const node of mut.removedNodes) {
            if (node.nodeType !== 1) continue;
            const els = isItem(node) ? [node] : [...(node.querySelectorAll?.(SELECTORS.item) ?? [])];
            for (const el of els) {
              const entry = state.seenItems.get(el);
              if (entry) writeItem(entry, state).then(() => updatePanel(doc));
            }
          }
          if (mut.type === "characterData" || mut.type === "childList") {
            const el = closestItem(mut.target);
            if (el) refreshItem(el, state);
          }
        }
      });
      state.observer.observe(region, { childList: true, subtree: true, characterData: true });
    }

    state.stabilityTimer = setInterval(async () => {
      for (const [el, entry] of state.seenItems) {
        if (!entry.finalized) {
          refreshItem(el, state);
          if (entry.stalePollCount >= STABILITY_POLLS) await writeItem(entry, state);
        }
      }
      updatePanel(doc);
    }, 1000);

    win.addEventListener("pagehide", () => stopStreaming(doc, win), { once: true });
    updatePanel(doc);
  }

  async function stopStreaming(doc = root.document, win = root) {
    const state = getStreamState();
    if (!state?.running) return;
    state.running = false;
    clearInterval(state.stabilityTimer);
    state.observer?.disconnect();
    for (const [, entry] of state.seenItems) await writeItem(entry, state);
    const meta = getMeta(doc, win);
    const elapsed = formatDuration(Date.now() - state.startedAt);
    try {
      await state.writable.write(
        `\n---\n\n*Stopped: ${new Date().toLocaleString()} · Duration: ${meta.duration || elapsed}*\n`,
      );
      await state.writable.close();
    } catch {}
    root[STATE_KEY] = null;
    updatePanel(doc);
  }

  // === Panel ===
  function updatePanel(doc = root.document) {
    const statusEl = doc.getElementById("gmeetcaptions-status");
    const btn = doc.getElementById("gmeetcaptions-record");
    if (!statusEl || !btn) return;
    const state = getStreamState();
    if (state?.running) {
      statusEl.textContent = `🔴 Recording… (${state.savedCount} turns saved · file saved on Stop)`;
      statusEl.style.color = "#f38ba8";
      btn.textContent = "■ Stop Recording";
      btn.style.background = "#f38ba8";
    } else {
      statusEl.textContent = "Ready";
      statusEl.style.color = "#a6e3a1";
      btn.textContent = "● Start Recording";
      btn.style.background = "#a6e3a1";
    }
  }

  function showPanel(doc = root.document, win = root, nav = root.navigator) {
    const existing = doc.getElementById(PANEL_ID);
    if (existing) {
      existing.style.display = existing.style.display === "none" ? "" : "none";
      return;
    }
    const panel = doc.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: "fixed",
      top: "80px",
      right: "16px",
      zIndex: "999999",
      background: "#1e1e2e",
      color: "#cdd6f4",
      borderRadius: "12px",
      padding: "12px 16px",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      boxShadow: "0 4px 24px rgba(0,0,0,.5)",
      minWidth: "220px",
      border: "1px solid #313244",
    });
    const makeEl = (tag, styles, text) => {
      const el = doc.createElement(tag);
      if (styles) Object.assign(el.style, styles);
      if (text) el.textContent = text;
      return el;
    };

    const header = makeEl("div", { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" });
    const title = makeEl("strong", { fontSize: "14px" }, "📝 Meet Captions");
    const closeBtn = makeEl("button", { background: "none", border: "none", color: "#cdd6f4", cursor: "pointer", fontSize: "18px", padding: "0", lineHeight: "1" }, "×");
    closeBtn.id = "gmeetcaptions-close";
    header.append(title, closeBtn);

    const status = makeEl("div", { marginBottom: "10px", color: "#a6e3a1", fontSize: "12px" }, "Ready");
    status.id = "gmeetcaptions-status";

    const btnRow = makeEl("div", { display: "flex", gap: "6px", flexWrap: "wrap" });
    const recordBtn = makeEl("button", { background: "#a6e3a1", color: "#1e1e2e", border: "none", borderRadius: "6px", padding: "5px 11px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }, "● Start Recording");
    recordBtn.id = "gmeetcaptions-record";
    const copyBtn = makeEl("button", { background: "#89b4fa", color: "#1e1e2e", border: "none", borderRadius: "6px", padding: "5px 11px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }, "Copy");
    copyBtn.id = "gmeetcaptions-copy";
    btnRow.append(recordBtn, copyBtn);

    panel.append(header, status, btnRow);
    doc.body.appendChild(panel);
    closeBtn.onclick = () => panel.remove();
    copyBtn.onclick = () => copyCaptions(doc, win, nav);
    recordBtn.onclick = async () => {
      if (getStreamState()?.running) await stopStreaming(doc, win);
      else await startStreaming(doc, win);
    };
    updatePanel(doc);
  }

  root.gmeetcaptions = {
    extractCaptions,
    copyCaptions,
    getMeta,
    startStreaming,
    stopStreaming,
    showPanel,
    scrape: showPanel,
  };
})(typeof window === "undefined" ? globalThis : window);
