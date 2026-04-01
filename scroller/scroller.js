// @ts-check

export const SCROLLER_HOST_ID = "bookmarklet-scroller-root";

const INSTANCE_KEY = "__bookmarkletScroller";
const MAX_SPEED = 1000;
const DEFAULT_SPEED = 300;
const TARGET_REFRESH_MS = 1200;
const EDGE_EPSILON = 1;
const WARNING_BORDER = "#dc3545";
const READY_BORDER = "#000000";
const SVG_NS = "http://www.w3.org/2000/svg";
const DELAYED_START_SECONDS = 3;

const iconPaths = {
  play: "M8 5.14v13.72a1 1 0 0 0 1.514.857l10.972-6.86a1 1 0 0 0 0-1.696L9.514 4.282A1 1 0 0 0 8 5.14Z",
  pause:
    "M8 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm8 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z",
  delayed:
    "M12.75 8.4a.75.75 0 1 0-1.5 0v4.35h-4.5a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 .75-.75zM9.75 1.5A.75.75 0 0 1 10.5.75h3a.75.75 0 0 1 0 1.5v.855c2.04.294 3.891 1.17 5.376 2.46l.018-.019.531-.531-.531-.53a.75.75 0 0 1 1.06-1.062l2.121 2.123a.75.75 0 1 1-1.06 1.06l-.53-.53-.531.53-.02.019A10.5 10.5 0 1 1 10.5 3.107V2.25a.75.75 0 0 1-.75-.75M12 4.5a9 9 0 1 0 .002 18A9 9 0 0 0 12 4.5",
  up: "M12 4a1 1 0 0 1 .707.293l5 5a1 1 0 1 1-1.414 1.414L13 7.414V20a1 1 0 1 1-2 0V7.414l-3.293 3.293A1 1 0 0 1 6.293 9.293l5-5A1 1 0 0 1 12 4Z",
  down: "M12 20a1 1 0 0 1-.707-.293l-5-5a1 1 0 0 1 1.414-1.414L11 16.586V4a1 1 0 1 1 2 0v12.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 20Z",
  close:
    "M6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293Z",
};

/**
 * @typedef {{
 *   element: HTMLElement,
 *   ownerDocument: Document,
 *   ownerWindow: Window & typeof globalThis,
 *   label: string,
 *   score: number,
 * }} ScrollTarget
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {Document} doc
 */
function describeDocument(doc) {
  const href = doc.defaultView?.location?.href;
  return href && href !== "about:blank" ? href : "current document";
}

/**
 * @param {Element} element
 */
function labelForElement(element) {
  const id = "id" in element && element.id ? `#${element.id}` : "";
  const className =
    "className" in element && typeof element.className === "string"
      ? element.className
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((token) => `.${token}`)
          .join("")
      : "";
  return `<${element.tagName.toLowerCase()}>${id}${className}`;
}

/**
 * @param {Element} element
 * @returns {element is HTMLElement}
 */
function isHTMLElement(element) {
  return (
    !!element &&
    element.nodeType === 1 &&
    "scrollHeight" in element &&
    "clientHeight" in element
  );
}

/**
 * @param {HTMLElement} element
 */
function getVerticalRange(element) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

/**
 * @param {Document} doc
 * @param {HTMLElement} element
 */
function isRootScrollable(doc, element) {
  return (
    element === doc.scrollingElement ||
    element === doc.documentElement ||
    element === doc.body
  );
}

/**
 * @param {Window & typeof globalThis} win
 * @param {HTMLElement} element
 */
function isProbablyScrollable(win, element) {
  if (element.id === SCROLLER_HOST_ID) return false;
  if (
    getVerticalRange(element) <= EDGE_EPSILON ||
    element.clientHeight <= 0 ||
    element.clientWidth <= 0
  )
    return false;
  if (element.closest?.(`#${SCROLLER_HOST_ID}`)) return false;
  if (isRootScrollable(element.ownerDocument, element)) return true;
  const overflowY = win.getComputedStyle(element).overflowY;
  return (
    overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay"
  );
}

/**
 * @param {Window & typeof globalThis} win
 * @param {Document} doc
 * @param {string[]} warnings
 * @returns {ScrollTarget[]}
 */
function collectScrollableTargets(win, doc, warnings) {
  /** @type {ScrollTarget[]} */
  const candidates = [];
  /** @type {Set<HTMLElement>} */
  const seen = new Set();

  /**
   * @param {HTMLElement} element
   */
  const pushCandidate = (element) => {
    if (seen.has(element) || !isProbablyScrollable(win, element)) return;
    seen.add(element);
    candidates.push({
      element,
      ownerDocument: doc,
      ownerWindow: win,
      label: labelForElement(element),
      score:
        getVerticalRange(element) * Math.max(1, element.clientWidth) +
        element.clientHeight,
    });
  };

  if (doc.scrollingElement && isHTMLElement(doc.scrollingElement))
    pushCandidate(doc.scrollingElement);
  if (isHTMLElement(doc.documentElement)) pushCandidate(doc.documentElement);
  if (doc.body && isHTMLElement(doc.body)) pushCandidate(doc.body);
  for (const element of doc.querySelectorAll("*"))
    if (isHTMLElement(element)) pushCandidate(element);

  for (const frame of doc.querySelectorAll("iframe, frame")) {
    try {
      const frameWindow = /** @type {Window & typeof globalThis} */ (
        frame.contentWindow
      );
      const frameDocument = frame.contentDocument ?? frameWindow?.document;
      if (!frameWindow || !frameDocument)
        throw new Error("Iframe document unavailable");
      candidates.push(
        ...collectScrollableTargets(frameWindow, frameDocument, warnings),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown access error";
      warnings.push(
        `Unable to inspect iframe on ${describeDocument(doc)}: ${message}`,
      );
    }
  }

  return candidates;
}

/**
 * @param {Document} doc
 * @param {Window & typeof globalThis} win
 */
export function findLargestScrollableTarget(doc = document, win = window) {
  /** @type {string[]} */
  const warnings = [];
  const candidates = collectScrollableTargets(win, doc, warnings).sort(
    (left, right) => right.score - left.score,
  );
  return {
    element: candidates[0]?.element ?? null,
    ownerDocument: candidates[0]?.ownerDocument ?? null,
    ownerWindow: candidates[0]?.ownerWindow ?? null,
    label: candidates[0]?.label ?? "",
    warnings,
  };
}

/**
 * @param {Document} doc
 * @param {keyof typeof iconPaths} name
 */
function createIcon(doc, name) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", iconPaths[name]);
  svg.append(path);
  return svg;
}

/**
 * @param {HTMLElement} element
 * @param {Document} doc
 * @param {keyof typeof iconPaths} name
 */
function setIcon(element, doc, name) {
  element.replaceChildren(createIcon(doc, name));
}

/**
 * @param {Document} doc
 */
function createStyle(doc) {
  const style = doc.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }
    * {
      box-sizing: border-box;
    }
    [data-role="shell"] {
      --scroller-fill: #ffffff;
      --scroller-border: ${READY_BORDER};
      --scroller-ink: #000000;
      align-items: center;
      backdrop-filter: blur(10px);
      background: var(--scroller-fill);
      border: 4px solid var(--scroller-border);
      border-radius: 999px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
      display: inline-flex;
      gap: 0;
      opacity: 0.1;
      overflow: hidden;
      padding: 3px;
      pointer-events: auto;
      transition:
        opacity 180ms ease,
        border-color 180ms ease,
        box-shadow 180ms ease;
      white-space: nowrap;
    }
    [data-role="shell"][data-expanded="true"],
    [data-role="shell"][data-status="warning"] {
      opacity: 0.96;
    }
    button,
    input,
    span,
    label,
    div {
      color: var(--scroller-ink);
      font: 13px/1.2 system-ui, sans-serif;
    }
    button {
      align-items: center;
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      display: inline-flex;
      flex: 0 0 auto;
      height: 38px;
      justify-content: center;
      margin: 0;
      padding: 0;
      width: 38px;
    }
    button:hover {
      background: rgba(0, 0, 0, 0.08);
    }
    button[data-active="true"] {
      background: rgba(0, 0, 0, 0.12);
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid rgba(13, 110, 253, 0.75);
      outline-offset: 2px;
    }
    svg {
      display: block;
      fill: currentColor;
      height: 20px;
      width: 20px;
    }
    [data-role="controls"] {
      align-items: center;
      display: flex;
      flex: 0 1 auto;
      flex-wrap: nowrap;
      gap: 8px;
      margin-inline-start: 0;
      max-width: 0;
      min-width: 0;
      opacity: 0;
      overflow: hidden;
      pointer-events: none;
      transition:
        max-width 180ms ease,
        opacity 140ms ease,
        margin-inline-start 180ms ease;
    }
    [data-role="shell"][data-expanded="true"] [data-role="controls"],
    [data-role="shell"][data-status="warning"] [data-role="controls"] {
      margin-inline-start: 6px;
      max-width: 460px;
      opacity: 1;
      pointer-events: auto;
    }
    [data-role="speed"] {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      gap: 8px;
      min-width: 0;
    }
    [data-role="speed"] input[type="range"] {
      accent-color: #111111;
      cursor: pointer;
      margin: 0;
      width: 150px;
    }
    [data-role="speed-value"] {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      min-width: 58px;
      text-align: right;
      white-space: nowrap;
    }
    [data-role="status"] {
      border-left: 1px solid rgba(0, 0, 0, 0.18);
      flex: 1 1 140px;
      font-size: 11px;
      min-width: 0;
      overflow: hidden;
      padding-left: 8px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
  return style;
}

/**
 * @param {ScrollTarget | null} target
 */
function getScrollTop(target) {
  return target?.element.scrollTop ?? 0;
}

/**
 * @param {ScrollTarget | null} target
 */
function getScrollLimit(target) {
  return target
    ? Math.max(0, target.element.scrollHeight - target.element.clientHeight)
    : 0;
}

/**
 * @param {ScrollTarget | null} target
 */
function targetCanStillScroll(target) {
  return !!target && getScrollLimit(target) > EDGE_EPSILON;
}

/**
 * @param {ScrollTarget} target
 * @param {number} desiredTop
 */
function setTargetScrollTop(target, desiredTop) {
  const nextTop = clamp(desiredTop, 0, getScrollLimit(target));
  if (typeof target.element.scrollTo === "function") {
    target.element.scrollTo({
      top: nextTop,
      left: target.element.scrollLeft,
      behavior: "instant",
    });
    return;
  }
  target.element.scrollTop = nextTop;
}

/**
 * @param {ScrollTarget} target
 * @param {number} delta
 */
function applyScrollDelta(target, delta) {
  const before = getScrollTop(target);
  const limit = getScrollLimit(target);
  const desiredTop = clamp(before + delta, 0, limit);
  if (Math.abs(desiredTop - before) <= EDGE_EPSILON / 10)
    return { ok: true, moved: 0, atEdge: true };
  try {
    setTargetScrollTop(target, desiredTop);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scroll error";
    return { ok: false, message: `Scroll request failed: ${message}` };
  }

  let after = getScrollTop(target);
  if (Math.abs(after - before) <= EDGE_EPSILON / 10) {
    target.element.scrollTop = desiredTop;
    after = getScrollTop(target);
  }
  if (Math.abs(after - before) <= EDGE_EPSILON / 10) {
    return {
      ok: false,
      message: "Scroll target rejected the synthetic scroll request.",
    };
  }
  return {
    ok: true,
    moved: after - before,
    atEdge: after <= EDGE_EPSILON || Math.abs(limit - after) <= EDGE_EPSILON,
  };
}

/**
 * @param {Document} doc
 * @param {Window & typeof globalThis} win
 */
export function createScrollerController(doc = document, win = window) {
  const existingHost = doc.getElementById(SCROLLER_HOST_ID);
  if (existingHost) existingHost.remove();

  const host = doc.createElement("div");
  host.id = SCROLLER_HOST_ID;
  host.style.position = "fixed";
  host.style.left = "16px";
  host.style.bottom = "16px";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });
  const style = createStyle(doc);
  const shell = doc.createElement("div");
  shell.dataset.role = "shell";
  shell.dataset.expanded = "false";
  shell.dataset.status = "ready";
  shell.dataset.warningKind = "";

  const playButton = doc.createElement("button");
  playButton.type = "button";
  playButton.dataset.action = "toggle-play";

  const controls = doc.createElement("div");
  controls.dataset.role = "controls";

  const speedWrap = doc.createElement("label");
  speedWrap.dataset.role = "speed";
  speedWrap.setAttribute("aria-label", "Scroll speed");

  const speedInput = doc.createElement("input");
  speedInput.type = "range";
  speedInput.min = "0";
  speedInput.max = String(MAX_SPEED);
  speedInput.step = "25";
  speedInput.value = String(DEFAULT_SPEED);
  speedInput.setAttribute("aria-label", "Scroll speed in pixels per second");

  const speedValue = doc.createElement("span");
  speedValue.dataset.role = "speed-value";

  const directionButton = doc.createElement("button");
  directionButton.type = "button";
  directionButton.dataset.action = "toggle-direction";

  const delayedButton = doc.createElement("button");
  delayedButton.type = "button";
  delayedButton.dataset.action = "delayed-start";

  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.action = "close";
  closeButton.setAttribute("aria-label", "Close scroller");
  setIcon(closeButton, doc, "close");

  const statusLine = doc.createElement("div");
  statusLine.dataset.role = "status";
  statusLine.setAttribute("aria-live", "polite");

  speedWrap.append(speedInput, speedValue);
  controls.append(
    delayedButton,
    speedWrap,
    directionButton,
    closeButton,
    statusLine,
  );
  shell.append(playButton, controls);
  shadow.replaceChildren(style, shell);
  doc.body.append(host);

  const state = {
    blockedAttempts: 0,
    countdownSeconds: /** @type {number | null} */ (null),
    countdownTimer: /** @type {number | null} */ (null),
    destroyed: false,
    direction: 1,
    focused: false,
    hovered: false,
    lastTimestamp: /** @type {number | null} */ (null),
    peek: false,
    peekTimer: /** @type {number | null} */ (null),
    playing: false,
    rafId: 0,
    speed: DEFAULT_SPEED,
    statusPinned: false,
    suppressHoverUntilLeave: false,
    target: /** @type {ScrollTarget | null} */ (null),
    targetResolvedAt: 0,
    warningKind: "",
    warningMessage: "",
  };

  const syncExpansion = () => {
    shell.dataset.expanded = String(
      state.hovered || state.focused || state.peek || state.statusPinned,
    );
  };

  const clearPeekTimer = () => {
    if (state.peekTimer != null) win.clearTimeout(state.peekTimer);
    state.peekTimer = null;
  };

  const clearCountdown = () => {
    if (state.countdownTimer != null) win.clearTimeout(state.countdownTimer);
    state.countdownSeconds = null;
    state.countdownTimer = null;
  };

  const reveal = () => {
    state.peek = true;
    clearPeekTimer();
    state.peekTimer = win.setTimeout(() => {
      state.peek = false;
      state.peekTimer = null;
      syncExpansion();
    }, 1500);
    syncExpansion();
  };

  const setStatus = (message, kind = "") => {
    state.warningKind = kind;
    state.warningMessage = message;
    state.statusPinned = !!kind;
    shell.dataset.status = kind ? "warning" : "ready";
    shell.dataset.warningKind = kind;
    shell.style.setProperty(
      "--scroller-border",
      kind ? WARNING_BORDER : READY_BORDER,
    );
    syncExpansion();
  };

  const collapseForPlayback = () => {
    clearPeekTimer();
    state.peek = false;
    state.hovered = false;
    state.focused = false;
    state.suppressHoverUntilLeave = true;
    syncExpansion();
  };

  const render = () => {
    playButton.dataset.state = state.playing ? "pause" : "play";
    playButton.setAttribute(
      "aria-label",
      state.playing ? "Pause autoscroll" : "Start autoscroll",
    );
    setIcon(playButton, doc, state.playing ? "pause" : "play");

    delayedButton.dataset.active = String(state.countdownSeconds != null);
    delayedButton.setAttribute(
      "aria-label",
      state.countdownSeconds != null
        ? "Cancel delayed start"
        : `Delayed start in ${DELAYED_START_SECONDS} seconds`,
    );
    setIcon(delayedButton, doc, "delayed");

    directionButton.dataset.direction = state.direction > 0 ? "down" : "up";
    directionButton.setAttribute(
      "aria-label",
      state.direction > 0 ? "Scroll down" : "Scroll up",
    );
    setIcon(directionButton, doc, state.direction > 0 ? "down" : "up");

    speedInput.value = String(state.speed);
    speedValue.textContent = `${Math.round(state.speed)} px/s`;

    const message =
      state.warningMessage ||
      (state.countdownSeconds != null
        ? `Starting in ${state.countdownSeconds}s`
        : "") ||
      (state.target ? `Target ${state.target.label}` : "Ready");
    statusLine.textContent = message;
    statusLine.title = message;
  };

  const cancelFrame = () => {
    if (state.rafId) win.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  };

  const pause = () => {
    state.playing = false;
    state.lastTimestamp = null;
    cancelFrame();
    render();
  };

  const scheduleDelayedStart = () => {
    if (state.playing) return;
    if (state.countdownSeconds != null) {
      clearCountdown();
      render();
      return;
    }
    state.countdownSeconds = DELAYED_START_SECONDS;
    render();

    const tick = () => {
      if (state.destroyed || state.countdownSeconds == null) return;
      if (state.countdownSeconds <= 1) {
        clearCountdown();
        start();
        return;
      }
      state.countdownSeconds -= 1;
      render();
      state.countdownTimer = win.setTimeout(tick, 1000);
    };

    state.countdownTimer = win.setTimeout(tick, 1000);
  };

  /**
   * @param {string[]} warnings
   */
  const logWarnings = (warnings) => {
    for (const warning of warnings) console.warn(`scroller: ${warning}`);
  };

  const resolveTarget = () => {
    const result = findLargestScrollableTarget(doc, win);
    if (result.warnings.length) logWarnings(result.warnings);
    state.targetResolvedAt = win.performance?.now?.() ?? Date.now();
    if (!result.element || !result.ownerDocument || !result.ownerWindow) {
      state.target = null;
      setStatus(
        result.warnings[0] ??
          "No accessible scrollable area was found on this page.",
        "no-target",
      );
      render();
      return null;
    }

    state.target = {
      element: result.element,
      ownerDocument: result.ownerDocument,
      ownerWindow: result.ownerWindow,
      label: result.label,
      score:
        Math.max(0, result.element.scrollHeight - result.element.clientHeight) *
          Math.max(1, result.element.clientWidth) +
        result.element.clientHeight,
    };
    setStatus("", "");
    render();
    return state.target;
  };

  /**
   * @param {number} timestamp
   */
  const step = (timestamp) => {
    if (state.destroyed || !state.playing) return;
    if (state.lastTimestamp == null) {
      state.lastTimestamp = timestamp;
      state.rafId = win.requestAnimationFrame(step);
      return;
    }

    const elapsed = Math.min(
      1000,
      Math.max(0, timestamp - state.lastTimestamp),
    );
    state.lastTimestamp = timestamp;

    if (
      !state.target ||
      !targetCanStillScroll(state.target) ||
      timestamp - state.targetResolvedAt >= TARGET_REFRESH_MS
    ) {
      resolveTarget();
    }
    if (!state.target) {
      pause();
      return;
    }

    const delta = (state.speed * elapsed * state.direction) / 1000;
    if (Math.abs(delta) > 0) {
      const result = applyScrollDelta(state.target, delta);
      if (!result.ok) {
        state.blockedAttempts += 1;
        console.warn(`scroller: ${result.message}`);
        if (state.blockedAttempts >= 2) {
          resolveTarget();
          const retried = state.target
            ? applyScrollDelta(state.target, delta)
            : { ok: false, message: result.message };
          if (!retried.ok) {
            setStatus(retried.message, "scroll-denied");
            pause();
            return;
          }
          if (retried.atEdge) {
            pause();
            return;
          }
          state.blockedAttempts = 0;
        }
      } else {
        state.blockedAttempts = 0;
        if (state.warningKind === "scroll-denied") setStatus("", "");
        if (result.atEdge) {
          pause();
          return;
        }
      }
    }

    state.rafId = win.requestAnimationFrame(step);
  };

  const start = () => {
    if (state.playing) return;
    clearCountdown();
    if (!resolveTarget()) return;
    state.playing = true;
    state.lastTimestamp = null;
    collapseForPlayback();
    render();
    state.rafId = win.requestAnimationFrame(step);
  };

  const destroy = () => {
    if (state.destroyed) return;
    state.destroyed = true;
    clearCountdown();
    clearPeekTimer();
    pause();
    delete win[INSTANCE_KEY];
    host.remove();
  };

  shell.addEventListener("mouseenter", () => {
    if (state.suppressHoverUntilLeave) return;
    state.hovered = true;
    syncExpansion();
  });
  shell.addEventListener("mouseleave", () => {
    state.hovered = false;
    state.suppressHoverUntilLeave = false;
    syncExpansion();
  });
  shell.addEventListener("focusin", () => {
    state.focused = true;
    syncExpansion();
  });
  shell.addEventListener("focusout", () => {
    state.focused = !!shadow.activeElement;
    syncExpansion();
  });
  playButton.addEventListener("click", () => {
    if (state.playing) pause();
    else {
      clearCountdown();
      start();
    }
  });
  delayedButton.addEventListener("click", scheduleDelayedStart);
  speedInput.addEventListener("input", () => {
    state.speed = clamp(Number(speedInput.value) || 0, 0, MAX_SPEED);
    render();
  });
  directionButton.addEventListener("click", () => {
    state.direction *= -1;
    render();
  });
  closeButton.addEventListener("click", destroy);

  setStatus("", "");
  render();
  syncExpansion();

  return {
    destroy,
    host,
    mount: start,
    pause,
    play: start,
    reveal,
    shadow,
    state,
  };
}

/**
 * @param {Document} doc
 * @param {Window & typeof globalThis} win
 */
export function mount(doc = document, win = window) {
  const existing =
    /** @type {ReturnType<typeof createScrollerController> | undefined} */ (
      win[INSTANCE_KEY]
    );
  if (existing?.host?.isConnected) {
    existing.reveal();
    return existing;
  }
  const controller = createScrollerController(doc, win);
  win[INSTANCE_KEY] = controller;
  return controller;
}

/**
 * @param {Document} doc
 * @param {Window & typeof globalThis} win
 */
export function teardown(doc = document, win = window) {
  const existing =
    /** @type {ReturnType<typeof createScrollerController> | undefined} */ (
      win[INSTANCE_KEY]
    );
  if (existing?.destroy) existing.destroy();
  doc.getElementById(SCROLLER_HOST_ID)?.remove();
  delete win[INSTANCE_KEY];
}
