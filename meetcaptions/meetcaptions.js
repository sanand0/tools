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

  function getMeetingId(win) {
    const location = win.location || {};
    const url = new URL(
      location.href || `${location.pathname || "/"}${location.search || ""}`,
      "https://invalid.local/",
    );
    const queryId = url.searchParams.get("meetingId") || url.searchParams.get("threadId");
    const segments = url.pathname.split("/").filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
    const joinIndex = segments.findIndex((part) => part.toLowerCase() === "meetup-join");
    const id = queryId || (joinIndex >= 0 ? segments[joinIndex + 1] : "") || "";
    return id.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function readTeamsTurn(item) {
    const speaker = normalize(item.querySelector('[data-tid="author"]')?.textContent || "");
    const text = normalize(item.querySelector('[data-tid="closed-caption-text"]')?.textContent || "");
    if (!speaker || !text) return null;
    return { speaker: escapeMarkdown(speaker), text: escapeMarkdown(text) };
  }

  function getTeamsMeta(doc = root.document, win = root) {
    return {
      title: normalize(doc.title.replace(/\s*\|\s*Microsoft Teams$/, "")),
      code: getMeetingId(win),
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
      filePrefix: "gmeet",
      emptyMessage: "No Google Meet captions found.",
      copiedMessage: "Google Meet captions copied to clipboard as Markdown.",
      getItems: getMeetItems,
      readTurn: readMeetTurn,
      getMeta: getMeetMeta,
    },
    teams: {
      id: "teams",
      stateKey: "__meetcaptionsTeamsState",
      title: "Microsoft Teams Captions",
      filePrefix: "teams",
      emptyMessage: "No Microsoft Teams captions found.",
      copiedMessage: "Microsoft Teams captions copied to clipboard as Markdown.",
      getItems: getTeamsItems,
      readTurn: readTeamsTurn,
      getMeta: getTeamsMeta,
    },
  };

  // Re-read controls on every attempt: meeting apps replace menus and caption panels.
  function maintainCaptions(doc, win, provider) {
    const key = `${provider.stateKey}Controls`;
    const enabledKey = `${provider.stateKey}CaptionsSeen`;
    if (root[key]) return;
    const control = { timer: null, lastClick: -Infinity };
    root[key] = control;
    const tick = () => {
      if (!doc.getElementById(ids(provider).panel) && !getStreamState(provider)?.running) {
        win.clearInterval(control.timer);
        root[key] = null;
        return;
      }
      const elements = [...doc.querySelectorAll('button, [role="button"], [role^="menuitem"], [role="switch"]')].filter(
        (el) =>
          !el.closest('[id^="meetcaptions-"]') &&
          !el.disabled &&
          el.getAttribute("aria-disabled") !== "true" &&
          !el.closest('[hidden], [aria-hidden="true"]') &&
          win.getComputedStyle(el).display !== "none" &&
          win.getComputedStyle(el).visibility !== "hidden",
      );
      const label = (el) => normalize(el.getAttribute("aria-label") || el.textContent);
      const find = (pattern) => elements.find((el) => pattern.test(label(el)));
      const on =
        provider.id === "google-meet"
          ? find(/^(turn off|disable|hide) (live )?captions/i) ||
            elements.find((el) => /captions/i.test(label(el)) && el.getAttribute("aria-pressed") === "true") ||
            getMeetRegion(doc)
          : doc.querySelector('[data-tid="closed-caption-renderer-wrapper"], [aria-label="Live Captions"]') ||
            find(/^(hide|turn off|disable) (live )?captions/i) ||
            getTeamsItems(doc).some((el) => readTeamsTurn(el));
      const status = doc.getElementById(`${ids(provider).panel}-captions`);
      if (on) root[enabledKey] = true;
      const disabled = !on && root[enabledKey];
      const message = on ? "Captions enabled" : disabled
        ? "Captions disabled — not capturing speech. Re-enable captions to resume."
        : "Waiting for captions — retrying. You can also enable them manually.";
      if (status && status.textContent !== message) status.textContent = message;
      const panel = doc.getElementById(ids(provider).panel);
      if (panel) {
        panel.style.background = disabled ? "#805719" : "#1e1e2e";
        panel.style.borderColor = disabled ? "#d9a441" : "#313244";
        panel.style.color = disabled ? "#fff4dc" : "#cdd6f4";
        panel.dataset.captionsDisabled = String(Boolean(disabled));
        updatePanel(doc, provider);
      }
      // Once captions have been enabled, respect intentional off-the-record pauses.
      if (on || root[enabledKey] || Date.now() - control.lastClick < 3000) return;
      let action = find(/^(turn on|enable|show) (live )?(closed )?captions/i);
      if (!action && provider.id === "google-meet") {
        action = find(/^captions( and translation)?$/i);
      } else if (!action && provider.id === "teams") {
        action =
          elements.find((el) => el.id === "LanguageSpeechMenuControl-id") ||
          find(/^language and speech$/i) ||
          elements.find(
            (el) =>
              el.id === "callingButtons-showMoreBtn" || el.getAttribute("data-tid") === "callingButtons-showMoreBtn",
          ) ||
          find(/^more( actions)?$/i);
      }
      // Never toggle an already expanded menu shut while waiting for its contents.
      if (
        action &&
        action.getAttribute("aria-expanded") !== "true" &&
        action.getAttribute("aria-checked") !== "true" &&
        action.getAttribute("aria-pressed") !== "true"
      ) {
        control.lastClick = Date.now();
        action.click();
      }
    };
    control.timer = win.setInterval(tick, 1000);
    tick();
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
    state.seenItems.set(el, {
      ...turn,
      firstSeenAt: Date.now(),
      stalePollCount: 0,
      finalized: false,
    });
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

  function writeItem(entry, state) {
    // Mutation callbacks, polls and Stop share one stream; seek/write/truncate must stay atomic.
    state.writeQueue = state.writeQueue.then(() => persistItem(entry, state));
    return state.writeQueue;
  }

  async function persistItem(entry, state) {
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
        suggestedName: `${provider.filePrefix}-${meta.code || "captions"}-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", "-")
          .replace(/:/g, "-")}.md`,
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
      writeQueue: Promise.resolve(),
    };
    root[provider.stateKey] = state;

    const scan = (poll = false) => {
      provider.getItems(doc).forEach((el) => trackItem(el, state));
      for (const [el, entry] of state.seenItems) {
        if (!el.isConnected) {
          // Preserve the final text even when the whole captions region disappears.
          refreshItem(el, state);
          writeItem(entry, state).then(() => {
            if (!el.isConnected) state.seenItems.delete(el);
          });
        } else if (poll || entry.text !== provider.readTurn(el)?.text) {
          refreshItem(el, state);
          if (entry.stalePollCount >= STABILITY_POLLS) writeItem(entry, state);
        }
      }
    };
    scan();
    state.observer = new win.MutationObserver(() => scan());
    state.observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    state.stabilityTimer = win.setInterval(() => {
      scan(true);
      updatePanel(doc, provider);
    }, 1000);
    maintainCaptions(doc, win, provider);

    win.addEventListener("pagehide", () => stopStreaming(doc, win, provider), {
      once: true,
    });
    updatePanel(doc, provider);
  }

  async function stopStreaming(doc = root.document, win = root, provider = providers.googleMeet) {
    const state = getStreamState(provider);
    if (!state?.running) return;
    state.running = false;
    win.clearInterval(state.stabilityTimer);
    state.observer?.disconnect();
    provider.getItems(doc).forEach((el) => trackItem(el, state));
    for (const [el, entry] of state.seenItems) {
      refreshItem(el, state);
      await writeItem(entry, state);
    }
    await state.writeQueue;
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
    const disabled = doc.getElementById(panelIds.panel)?.dataset.captionsDisabled === "true";
    if (state?.running) {
      statusEl.textContent = `Recording... (${state.savedCount} turns saved; file saved on Stop)`;
      statusEl.style.color = disabled ? "#fff4dc" : "#f38ba8";
      btn.textContent = "Stop Recording";
      btn.style.background = "#f38ba8";
    } else {
      statusEl.textContent = "Ready";
      statusEl.style.color = disabled ? "#fff4dc" : "#a6e3a1";
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
      cursor: "grab",
      touchAction: "none",
    });
    const title = makeEl("strong", { fontSize: "14px" }, provider.title);
    const closeBtn = makeEl(
      "button",
      {
        background: "none",
        border: "none",
        color: "inherit",
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

    const btnRow = makeEl("div", {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
    });
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

    const captionStatus = makeEl("div", {
      marginBottom: "8px",
      fontSize: "12px",
      maxWidth: "280px",
    });
    captionStatus.id = `${panelIds.panel}-captions`;
    captionStatus.setAttribute("role", "status");
    panel.append(header, status, captionStatus, btnRow);
    doc.body.appendChild(panel);
    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      header.style.cursor = "grabbing";
      event.preventDefault();
    });
    const movePanel = (event) => {
      if (!drag) return;
      const maxLeft = Math.max(0, win.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, win.innerHeight - panel.offsetHeight);
      panel.style.left = `${Math.max(0, Math.min(maxLeft, drag.left + event.clientX - drag.x))}px`;
      panel.style.top = `${Math.max(0, Math.min(maxTop, drag.top + event.clientY - drag.y))}px`;
      panel.style.right = "auto";
    };
    const endDrag = () => {
      drag = null;
      header.style.cursor = "grab";
    };
    doc.addEventListener("pointermove", movePanel);
    doc.addEventListener("pointerup", endDrag);
    doc.addEventListener("pointercancel", endDrag);
    closeBtn.onclick = () => {
      endDrag();
      doc.removeEventListener("pointermove", movePanel);
      doc.removeEventListener("pointerup", endDrag);
      doc.removeEventListener("pointercancel", endDrag);
      panel.remove();
    };
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
      scrape: (doc = root.document, win = root, nav = root.navigator) => {
        showPanel(doc, win, nav, provider);
        maintainCaptions(doc, win, provider);
      },
    };
  }

  root.meetcaptions = {
    googleMeet: apiFor(providers.googleMeet),
    teams: apiFor(providers.teams),
  };
  root.gmeetcaptions = root.meetcaptions.googleMeet;
})(typeof window === "undefined" ? globalThis : window);
