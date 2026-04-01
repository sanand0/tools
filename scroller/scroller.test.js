// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "happy-dom";
import { loadFrom } from "../common/testutils.js";
import {
  createScrollerController,
  findLargestScrollableTarget,
  mount,
  SCROLLER_HOST_ID,
} from "./scroller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolDir = path.join(__dirname);
const minPath = path.join(toolDir, "scroller.min.js");

const browser = new Browser({ console });

/** @returns {Promise<string>} */
const readMinified = async () => fs.promises.readFile(minPath, "utf8");

/** @param {Document} document */
function installScrollableFixture(document) {
  const page = document.createElement("div");
  page.id = "page-scroll";
  page.style.overflowY = "auto";
  document.body.append(page);
  Object.defineProperties(page, {
    clientHeight: { configurable: true, value: 200 },
    clientWidth: { configurable: true, value: 320 },
    scrollHeight: { configurable: true, value: 2600 },
    scrollWidth: { configurable: true, value: 320 },
  });
  page.scrollTop = 0;
  page.scrollLeft = 0;
  page.scrollTo = ({ top = 0, left = 0 }) => {
    if (Number.isFinite(top)) page.scrollTop = top;
    if (Number.isFinite(left)) page.scrollLeft = left;
  };
  page.scrollBy = ({ top = 0, left = 0 }) => {
    page.scrollTop += top;
    page.scrollLeft += left;
  };
  return page;
}

/** @param {Window & typeof globalThis} window */
function createRafController(window) {
  let nextId = 1;
  /** @type {Map<number, FrameRequestCallback>} */
  const callbacks = new Map();
  window.requestAnimationFrame = (callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
  };
  return {
    step(timestamp) {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(timestamp);
    },
  };
}

/** @param {{ shadow: ShadowRoot }} controller */
function getStyleText(controller) {
  return controller.shadow.querySelector("style")?.textContent ?? "";
}

describe("scroller bookmarklet page", () => {
  it("sets bookmarklet href using bundled script", async () => {
    const { document } = await loadFrom(toolDir);
    const link = document.getElementById("bookmarklet");
    if (!link) throw new Error("bookmarklet link missing");
    const minified = (await readMinified()).trim();
    expect(link.getAttribute("href")).toBe(
      "javascript:" + encodeURIComponent(`${minified};scroller.mount();`),
    );
  });
});

describe("scroller runtime", () => {
  /** @type {import("happy-dom").Page} */
  let page;
  /** @type {Window & typeof globalThis} */
  let window;
  /** @type {Document} */
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    window = /** @type {Window & typeof globalThis} */ (page.mainFrame.window);
    document = page.mainFrame.document;
    document.open();
    document.write(
      "<!doctype html><html><body><main>Test</main></body></html>",
    );
    document.close();
    await page.waitUntilComplete();
  });

  it("mounts a single shadow-root host and reuses it", () => {
    installScrollableFixture(document);
    const first = mount(document, window);
    const second = mount(document, window);
    const hosts = document.querySelectorAll(`#${SCROLLER_HOST_ID}`);

    expect(first.host).toBe(second.host);
    expect(hosts.length).toBe(1);
    expect(first.host.shadowRoot).toBeTruthy();
    expect(first.host.style.position).toBe("fixed");
    expect(first.host.style.left).toBe("16px");
    expect(first.host.style.bottom).toBe("16px");
  });

  it("expands on hover and exposes the controls inside the shadow root", () => {
    installScrollableFixture(document);
    const controller = createScrollerController(document, window);
    const shell = controller.shadow.querySelector('[data-role="shell"]');
    const play = controller.shadow.querySelector('[data-action="toggle-play"]');
    const slider = /** @type {HTMLInputElement | null} */ (
      controller.shadow.querySelector('input[type="range"]')
    );
    const speedValue = controller.shadow.querySelector(
      '[data-role="speed-value"]',
    );
    if (!shell) throw new Error("shell missing");
    if (!play || !slider || !speedValue) throw new Error("controls missing");

    expect(shell.getAttribute("data-expanded")).toBe("false");
    expect(
      controller.shadow.querySelector('[data-action="toggle-panel"]'),
    ).toBeNull();
    expect(play).toBeTruthy();
    expect(slider.max).toBe("1000");
    expect(slider.value).toBe("300");
    expect(speedValue.textContent).toBe("300 px/s");
    expect(getStyleText(controller)).toContain("opacity: 0.1;");
    expect(getStyleText(controller)).toContain("padding: 3px;");
    expect(getStyleText(controller)).toContain("flex-wrap: nowrap;");
    shell.dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
    expect(shell.getAttribute("data-expanded")).toBe("true");

    expect(
      controller.shadow.querySelector('[data-action="toggle-direction"]'),
    ).toBeTruthy();
    expect(
      controller.shadow.querySelector('[data-action="delayed-start"]'),
    ).toBeTruthy();
    expect(
      controller.shadow.querySelector('[data-action="close"]'),
    ).toBeTruthy();
    expect(controller.shadow.querySelector('input[type="range"]')).toBeTruthy();
  });

  it("scrolls smoothly, updates speed live, and reverses direction live", () => {
    const target = installScrollableFixture(document);
    const controller = createScrollerController(document, window);
    const raf = createRafController(window);
    const shell = /** @type {HTMLElement | null} */ (
      controller.shadow.querySelector('[data-role="shell"]')
    );
    const play = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="toggle-play"]')
    );
    const slider = /** @type {HTMLInputElement | null} */ (
      controller.shadow.querySelector('input[type="range"]')
    );
    const direction = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="toggle-direction"]')
    );
    if (!shell || !play || !slider || !direction)
      throw new Error("controls missing");

    shell.dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
    expect(shell.getAttribute("data-expanded")).toBe("true");
    play.click();
    expect(shell.getAttribute("data-expanded")).toBe("false");
    raf.step(1000);
    raf.step(2000);
    expect(target.scrollTop).toBeCloseTo(300, 3);
    expect(play.getAttribute("data-state")).toBe("pause");

    slider.value = "600";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));
    raf.step(3000);
    expect(target.scrollTop).toBeCloseTo(900, 3);

    direction.click();
    expect(direction.getAttribute("data-direction")).toBe("up");
    raf.step(4000);
    expect(target.scrollTop).toBeCloseTo(300, 3);

    play.click();
    expect(play.getAttribute("data-state")).toBe("play");
  });

  it("starts after a 3 second delayed countdown and collapses when playback begins", () => {
    vi.useFakeTimers();
    try {
      window.setTimeout = setTimeout;
      window.clearTimeout = clearTimeout;
      const target = installScrollableFixture(document);
      const controller = createScrollerController(document, window);
      const raf = createRafController(window);
      const shell = /** @type {HTMLElement | null} */ (
        controller.shadow.querySelector('[data-role="shell"]')
      );
      const delayed = /** @type {HTMLButtonElement | null} */ (
        controller.shadow.querySelector('[data-action="delayed-start"]')
      );
      const play = /** @type {HTMLButtonElement | null} */ (
        controller.shadow.querySelector('[data-action="toggle-play"]')
      );
      const status = /** @type {HTMLElement | null} */ (
        controller.shadow.querySelector('[data-role="status"]')
      );
      if (!shell || !delayed || !play || !status)
        throw new Error("controls missing");

      shell.dispatchEvent(
        new window.MouseEvent("mouseenter", { bubbles: true }),
      );
      delayed.click();
      expect(status.textContent).toContain("Starting in 3s");
      expect(play.getAttribute("data-state")).toBe("play");

      vi.advanceTimersByTime(2999);
      expect(target.scrollTop).toBe(0);
      expect(play.getAttribute("data-state")).toBe("play");
      expect(shell.getAttribute("data-expanded")).toBe("true");

      vi.advanceTimersByTime(1);
      expect(play.getAttribute("data-state")).toBe("pause");
      expect(shell.getAttribute("data-expanded")).toBe("false");

      raf.step(4000);
      raf.step(5000);
      expect(target.scrollTop).toBeCloseTo(300, 3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses automatically when reaching the start or end of the scroll range", () => {
    const target = installScrollableFixture(document);
    Object.defineProperty(target, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    const controller = createScrollerController(document, window);
    const raf = createRafController(window);
    const play = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="toggle-play"]')
    );
    const direction = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="toggle-direction"]')
    );
    if (!play || !direction) throw new Error("controls missing");

    play.click();
    raf.step(1000);
    raf.step(2000);
    expect(target.scrollTop).toBe(300);
    expect(play.getAttribute("data-state")).toBe("play");

    direction.click();
    play.click();
    raf.step(3000);
    raf.step(4000);
    expect(target.scrollTop).toBe(0);
    expect(play.getAttribute("data-state")).toBe("play");
  });

  it("finds the largest accessible scrollable area and reports denied iframes", () => {
    installScrollableFixture(document);

    const larger = document.createElement("section");
    larger.id = "larger-scroll";
    larger.style.overflowY = "auto";
    document.body.append(larger);
    Object.defineProperties(larger, {
      clientHeight: { configurable: true, value: 400 },
      clientWidth: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 5000 },
      scrollWidth: { configurable: true, value: 500 },
    });
    larger.scrollTop = 0;
    larger.scrollTo = ({ top = 0 }) => {
      larger.scrollTop = top;
    };
    larger.scrollBy = ({ top = 0 }) => {
      larger.scrollTop += top;
    };

    const frame = document.createElement("iframe");
    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      get() {
        throw new DOMException("Permission denied", "SecurityError");
      },
    });
    document.body.append(frame);

    const result = findLargestScrollableTarget(document, window);
    expect(result.element).toBe(larger);
    expect(result.warnings.join("\n")).toMatch(/iframe|permission/i);
  });

  it("shows a warning state and red border when no accessible scroll target exists", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const frame = document.createElement("iframe");
      Object.defineProperty(frame, "contentDocument", {
        configurable: true,
        get() {
          throw new DOMException("Permission denied", "SecurityError");
        },
      });
      document.body.append(frame);

      const controller = createScrollerController(document, window);
      const play = /** @type {HTMLButtonElement | null} */ (
        controller.shadow.querySelector('[data-action="toggle-play"]')
      );
      const shell = /** @type {HTMLElement | null} */ (
        controller.shadow.querySelector('[data-role="shell"]')
      );
      if (!play || !shell) throw new Error("UI missing");

      play.click();
      expect(shell.getAttribute("data-status")).toBe("warning");
      expect(shell.getAttribute("data-warning-kind")).toBe("no-target");
      expect(shell.style.getPropertyValue("--scroller-border")).toBe("#dc3545");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("mounts without innerHTML assignments when Trusted Types blocks them", () => {
    installScrollableFixture(document);
    const elementDescriptor = Object.getOwnPropertyDescriptor(
      window.Element.prototype,
      "innerHTML",
    );
    const shadowDescriptor = Object.getOwnPropertyDescriptor(
      window.ShadowRoot.prototype,
      "innerHTML",
    );
    if (!elementDescriptor || !shadowDescriptor) {
      throw new Error("innerHTML descriptors missing");
    }

    Object.defineProperty(window.Element.prototype, "innerHTML", {
      configurable: true,
      get() {
        return elementDescriptor.get?.call(this) ?? "";
      },
      set() {
        throw new TypeError("TrustedHTML required");
      },
    });
    Object.defineProperty(window.ShadowRoot.prototype, "innerHTML", {
      configurable: true,
      get() {
        return shadowDescriptor.get?.call(this) ?? "";
      },
      set() {
        throw new TypeError("TrustedHTML required");
      },
    });

    try {
      const controller = createScrollerController(document, window);
      expect(controller.host.isConnected).toBe(true);
      expect(
        controller.shadow.querySelector('[data-action="toggle-play"]'),
      ).toBeTruthy();
    } finally {
      Object.defineProperty(
        window.Element.prototype,
        "innerHTML",
        elementDescriptor,
      );
      Object.defineProperty(
        window.ShadowRoot.prototype,
        "innerHTML",
        shadowDescriptor,
      );
    }
  });

  it("closes cleanly and stops scrolling", () => {
    const target = installScrollableFixture(document);
    const controller = createScrollerController(document, window);
    const raf = createRafController(window);
    const play = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="toggle-play"]')
    );
    const close = /** @type {HTMLButtonElement | null} */ (
      controller.shadow.querySelector('[data-action="close"]')
    );
    if (!play || !close) throw new Error("controls missing");

    play.click();
    raf.step(500);
    raf.step(1500);
    expect(target.scrollTop).toBeGreaterThan(0);

    close.click();
    const snapshot = target.scrollTop;
    expect(document.getElementById(SCROLLER_HOST_ID)).toBeNull();

    raf.step(2500);
    expect(target.scrollTop).toBe(snapshot);
  });
});
