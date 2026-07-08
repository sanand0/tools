// @ts-check
(function (root) {
  const STABILITY_POLLS = 4; // finalize after this many 1s polls with unchanged text
  const AVATAR_SEL = 'img[data-iml], img[src*="googleusercontent.com"]';

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

  const meetSelectors = {
    region: '[role="region"][aria-label="Captions"]',
    item: ".nMcdL",
    speaker: ".NWpY1d",
    text: ".ygicle",
    timer: '[jsname="W5i7Bf"]',
    moreOptions: '[aria-label^="More options for "]',
  };

  function getMeetRegion(doc = root.document) {
    return (
      doc.querySelector(meetSelectors.region) ||
      [...doc.querySelectorAll('[role="region"][aria-label], [aria-label="Captions"]')].find(
        (node) => normalize(node.getAttribute?.("aria-label")) === "Captions",
      ) ||
      null
    );
  }

  function isMeetItem(node) {
    return node.nodeType === 1 && (node.matches?.(meetSelectors.item) || !!node.querySelector?.(AVATAR_SEL));
  }

  function getMeetItems(doc = root.document) {
    const region = getMeetRegion(doc);
    if (!region) return [];
    const byClass = [...region.querySelectorAll(meetSelectors.item)];
    if (byClass.length) return byClass;
    return [...region.children].filter((el) => el.querySelector(AVATAR_SEL));
  }

  function getMeetSpeakerEl(item) {
    return item.querySelector(meetSelectors.speaker) || item.querySelector("span");
  }

  function getMeetTextEl(item) {
    return (
      item.querySelector(meetSelectors.text) ||
      findLast([...item.children], (el) => el.tagName === "DIV" && !el.querySelector(AVATAR_SEL))
    );
  }

  function readMeetTurn(item) {
    const speaker = normalize(getMeetSpeakerEl(item)?.textContent || "");
    const text = normalize(getMeetTextEl(item)?.textContent || "");
    if (!speaker || !text) return null;
    return { speaker: escapeMarkdown(speaker), text: escapeMarkdown(text) };
  }

  function getMeetMeta(doc = root.document, win = root) {
    const title = normalize(
      doc.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title") ||
        doc.title.replace(/^Meet\s*[-–]\s*/, ""),
    );
    const code = (win.location?.pathname || "").replace(/^\//, "");
    const duration = doc.querySelector(meetSelectors.timer)?.textContent?.trim() || "";
    const participants = [...doc.querySelectorAll(meetSelectors.moreOptions)]
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

  function getTeamsItems(doc = root.document) {
    return [...doc.querySelectorAll('[role="log"]')].filter(
      (el) => normalize(el.querySelector('[data-tid="closed-caption-text"]')?.textContent || el.textContent).length > 0,
    );
  }

  function isTeamsItem(node) {
    return node.nodeType === 1 && node.matches?.('[role="log"]');
  }

  function readTeamsTurn(item) {
    const speaker = normalize(item.querySelector('[data-tid="author"]')?.textContent || "");
    const text = normalize(item.querySelector('[data-tid="closed-caption-text"]')?.textContent || "");
    if (!speaker || !text) return null;
    return { speaker: escapeMarkdown(speaker), text: escapeMarkdown(text) };
  }

  function getTeamsMeta(doc = root.document) {
    return {
      title: normalize(doc.title.replace(/\s*\|\s*Microsoft Teams$/, "")),
      code: "",
      duration: "",
      participants: [
        ...new Set(getTeamsItems(doc).map((item) => normalize(item.querySelector('[data-tid="author"]')?.textContent))),
      ].filter(Boolean),
    };
  }

  const providers = {
    googleMeet: {
      id: "google-meet",
      globalName: "gmeetcaptions",
      stateKey: "__meetcaptionsGoogleMeetState",
      title: "Google Meet Captions",
      filePrefix: "meet",
      emptyMessage: "No Google Meet captions found.",
      copiedMessage: "Google Meet captions copied to clipboard as Markdown.",
      getItems: getMeetItems,
      isItem: isMeetItem,
      readTurn: readMeetTurn,
      getMeta: getMeetMeta,
      rootForObserver: (doc) => getMeetRegion(doc),
      itemSelector: meetSelectors.item,
    },
    teams: {
      id: "teams",
      stateKey: "__meetcaptionsTeamsState",
      title: "Microsoft Teams Captions",
      filePrefix: "teams",
      emptyMessage: "No Microsoft Teams captions found.",
      copiedMessage: "Microsoft Teams captions copied to clipboard as Markdown.",
      getItems: getTeamsItems,
      isItem: isTeamsItem,
      readTurn: readTeamsTurn,
      getMeta: getTeamsMeta,
      rootForObserver: (doc) => doc.body,
      itemSelector: '[role="log"]',
    },
  };

  function closestItem(node, provider) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el) {
      if (provider.isItem(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function rawTurns(doc = root.document, provider = providers.googleMeet) {
    return provider.getItems(doc).map(provider.readTurn).filter(Boolean);
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

  function renderMarkdown(turns, provider) {
    if (turns.length === 0) return "";
    return [`# ${provider.title}`, "", ...turns.flatMap(({ speaker, text }) => [`## ${speaker}`, "", text, ""])]
      .join("\n")
      .trim();
  }

  function extractCaptions(doc = root.document, provider = providers.googleMeet) {
    return renderMarkdown(mergeTurns(rawTurns(doc, provider)), provider);
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

  async function copyCaptions(doc = root.document, win = root, nav = root.navigator, provider = providers.googleMeet) {
    const markdown = extractCaptions(doc, provider);
    const notify = win?.alert ?? console.warn;
    if (!markdown) {
      notify(provider.emptyMessage);
      return "";
    }
    const ok = await copyText(markdown, doc, nav);
    notify(ok ? provider.copiedMessage : `Failed to copy ${provider.title}.`);
    return markdown;
  }

  function getStreamState(provider) {
    return root[provider.stateKey] || null;
  }

  function trackItem(el, state) {
    if (state.seenItems.has(el)) return;
    const turn = state.provider.readTurn(el);
    if (!turn) return;
    state.seenItems.set(el, { ...turn, firstSeenAt: Date.now(), stalePollCount: 0, finalized: false });
  }

  function refreshItem(el, state) {
    const entry = state.seenItems.get(el);
    if (!entry) return;
    const turn = state.provider.readTurn(el);
    if (!turn) return;
    if (entry.text !== turn.text) {
      if (entry.finalized) entry.finalized = false;
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

  async function startStreaming(doc = root.document, win = root, provider = providers.googleMeet) {
    if (getStreamState(provider)?.running) return;
    if (typeof win.showSaveFilePicker !== "function") {
      (win.alert ?? console.warn)("File saving is not supported in this browser.");
      return;
    }

    const meta = provider.getMeta(doc, win);
    let writable;
    try {
      const fileHandle = await win.showSaveFilePicker({
        suggestedName: `${provider.filePrefix}-${meta.code || "captions"}-${new Date().toISOString().slice(0, 10)}.md`,
        types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      });
      writable = await fileHandle.createWritable();
    } catch (e) {
      if (e?.name !== "AbortError") console.error("meetcaptions:", e);
      return;
    }

    const startedAt = Date.now();
    const header = [
      `# ${escapeMarkdown(meta.title || provider.title)}`,
      "",
      meta.code ? `- **Meeting code**: ${meta.code}` : "",
      `- **Started**: ${new Date(startedAt).toLocaleString()}`,
      meta.participants.length ? `- **Participants**: ${meta.participants.map(escapeMarkdown).join(", ")}` : "",
      "",
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await writable.write(header);

    const state = {
      running: true,
      provider,
      writable,
      startedAt,
      filePosition: new TextEncoder().encode(header).length,
      seenItems: new Map(),
      observer: null,
      stabilityTimer: null,
      savedCount: 0,
    };
    root[provider.stateKey] = state;

    const observerRoot = provider.rootForObserver(doc);
    if (observerRoot) {
      provider.getItems(doc).forEach((el) => trackItem(el, state));
      state.observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
          for (const node of mut.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (provider.isItem(node)) trackItem(node, state);
            else node.querySelectorAll?.(provider.itemSelector)?.forEach((n) => trackItem(n, state));
          }
          for (const node of mut.removedNodes) {
            if (node.nodeType !== 1) continue;
            const els = provider.isItem(node) ? [node] : [...(node.querySelectorAll?.(provider.itemSelector) ?? [])];
            for (const el of els) {
              const entry = state.seenItems.get(el);
              if (entry) writeItem(entry, state).then(() => updatePanel(doc, provider));
            }
          }
          const el = closestItem(mut.target, provider);
          if (el) refreshItem(el, state);
        }
      });
      state.observer.observe(observerRoot, { childList: true, subtree: true, characterData: true });
    }

    state.stabilityTimer = setInterval(async () => {
      for (const [el, entry] of state.seenItems) {
        if (!entry.finalized) {
          refreshItem(el, state);
          if (entry.stalePollCount >= STABILITY_POLLS) await writeItem(entry, state);
        }
      }
      updatePanel(doc, provider);
    }, 1000);

    win.addEventListener("pagehide", () => stopStreaming(doc, win, provider), { once: true });
    updatePanel(doc, provider);
  }

  async function stopStreaming(doc = root.document, win = root, provider = providers.googleMeet) {
    const state = getStreamState(provider);
    if (!state?.running) return;
    state.running = false;
    clearInterval(state.stabilityTimer);
    state.observer?.disconnect();
    for (const [, entry] of state.seenItems) await writeItem(entry, state);
    const meta = provider.getMeta(doc, win);
    const elapsed = formatDuration(Date.now() - state.startedAt);
    try {
      await state.writable.write(
        `\n---\n\n*Stopped: ${new Date().toLocaleString()} - Duration: ${meta.duration || elapsed}*\n`,
      );
      await state.writable.close();
    } catch {}
    root[provider.stateKey] = null;
    updatePanel(doc, provider);
  }

  function ids(provider) {
    const prefix = `meetcaptions-${provider.id}`;
    return {
      panel: `${prefix}-panel`,
      status: `${prefix}-status`,
      record: `${prefix}-record`,
      copy: `${prefix}-copy`,
      close: `${prefix}-close`,
    };
  }

  function updatePanel(doc = root.document, provider = providers.googleMeet) {
    const panelIds = ids(provider);
    const statusEl = doc.getElementById(panelIds.status);
    const btn = doc.getElementById(panelIds.record);
    if (!statusEl || !btn) return;
    const state = getStreamState(provider);
    if (state?.running) {
      statusEl.textContent = `Recording... (${state.savedCount} turns saved; file saved on Stop)`;
      statusEl.style.color = "#f38ba8";
      btn.textContent = "Stop Recording";
      btn.style.background = "#f38ba8";
    } else {
      statusEl.textContent = "Ready";
      statusEl.style.color = "#a6e3a1";
      btn.textContent = "Start Recording";
      btn.style.background = "#a6e3a1";
    }
  }

  function showPanel(doc = root.document, win = root, nav = root.navigator, provider = providers.googleMeet) {
    const panelIds = ids(provider);
    const existing = doc.getElementById(panelIds.panel);
    if (existing) {
      existing.style.display = existing.style.display === "none" ? "" : "none";
      return;
    }
    const panel = doc.createElement("div");
    panel.id = panelIds.panel;
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

    const header = makeEl("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px",
    });
    const title = makeEl("strong", { fontSize: "14px" }, provider.title);
    const closeBtn = makeEl(
      "button",
      {
        background: "none",
        border: "none",
        color: "#cdd6f4",
        cursor: "pointer",
        fontSize: "18px",
        padding: "0",
        lineHeight: "1",
      },
      "x",
    );
    closeBtn.id = panelIds.close;
    header.append(title, closeBtn);

    const status = makeEl("div", { marginBottom: "10px", color: "#a6e3a1", fontSize: "12px" }, "Ready");
    status.id = panelIds.status;

    const btnRow = makeEl("div", { display: "flex", gap: "6px", flexWrap: "wrap" });
    const recordBtn = makeEl(
      "button",
      {
        background: "#a6e3a1",
        color: "#1e1e2e",
        border: "none",
        borderRadius: "6px",
        padding: "5px 11px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "600",
      },
      "Start Recording",
    );
    recordBtn.id = panelIds.record;
    const copyBtn = makeEl(
      "button",
      {
        background: "#89b4fa",
        color: "#1e1e2e",
        border: "none",
        borderRadius: "6px",
        padding: "5px 11px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "600",
      },
      "Copy",
    );
    copyBtn.id = panelIds.copy;
    btnRow.append(recordBtn, copyBtn);

    panel.append(header, status, btnRow);
    doc.body.appendChild(panel);
    closeBtn.onclick = () => panel.remove();
    copyBtn.onclick = () => copyCaptions(doc, win, nav, provider);
    recordBtn.onclick = async () => {
      if (getStreamState(provider)?.running) await stopStreaming(doc, win, provider);
      else await startStreaming(doc, win, provider);
    };
    updatePanel(doc, provider);
  }

  function apiFor(provider) {
    return {
      extractCaptions: (doc = root.document) => extractCaptions(doc, provider),
      copyCaptions: (doc = root.document, win = root, nav = root.navigator) => copyCaptions(doc, win, nav, provider),
      getMeta: (doc = root.document, win = root) => provider.getMeta(doc, win),
      startStreaming: (doc = root.document, win = root) => startStreaming(doc, win, provider),
      stopStreaming: (doc = root.document, win = root) => stopStreaming(doc, win, provider),
      showPanel: (doc = root.document, win = root, nav = root.navigator) => showPanel(doc, win, nav, provider),
      scrape: (doc = root.document, win = root, nav = root.navigator) => showPanel(doc, win, nav, provider),
    };
  }

  root.meetcaptions = {
    googleMeet: apiFor(providers.googleMeet),
    teams: apiFor(providers.teams),
  };
  root.gmeetcaptions = root.meetcaptions.googleMeet;
})(typeof window === "undefined" ? globalThis : window);
