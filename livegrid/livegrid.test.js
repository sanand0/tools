import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "happy-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createLiveGrid } from "./app.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const rawHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const rawScript = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = rawHtml
  .replace(/<link[^>]+href="https:[^>]*>/g, "")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const roomA = "11111111-1111-4111-8111-111111111111";
const roomB = "22222222-2222-4222-8222-222222222222";

class MemoryStorage {
  constructor(entries = []) {
    this.data = new Map(entries);
  }
  get length() {
    return this.data.size;
  }
  key(index) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

function makeFirestore() {
  const docs = new Map();
  const listeners = new Map();
  const snapshot = (path, fromCache = false) => ({
    exists: () => docs.has(path),
    data: () => structuredClone(docs.get(path)),
    metadata: { fromCache },
  });
  const emit = (path, fromCache = false) =>
    [...(listeners.get(path) ?? [])].forEach(({ next }) =>
      next(snapshot(path, fromCache)),
    );
  const api = {
    db: {},
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
    onSnapshot: vi.fn((ref, next, error) => {
      const handlers = listeners.get(ref.path) ?? [];
      handlers.push({ next, error });
      listeners.set(ref.path, handlers);
      queueMicrotask(() => next(snapshot(ref.path, !api.online)));
      return () =>
        listeners.set(
          ref.path,
          handlers.filter((handler) => handler.next !== next),
        );
    }),
    setDoc: vi.fn(async (ref, value) => {
      if (!api.online)
        throw Object.assign(new Error("Client is offline"), {
          code: "unavailable",
        });
      docs.set(ref.path, structuredClone(value));
      emit(ref.path);
    }),
    deleteDoc: vi.fn(async (ref) => {
      if (!api.online)
        throw Object.assign(new Error("Missing or insufficient permissions"), {
          code: "permission-denied",
        });
      docs.delete(ref.path);
      emit(ref.path);
    }),
    online: true,
    docs,
    emit,
    fail(path, error) {
      [...(listeners.get(path) ?? [])].forEach((handler) =>
        handler.error(error),
      );
    },
  };
  return api;
}

const tick = () => Promise.resolve();

describe("LiveGrid", () => {
  const browser = new Browser({ console });
  const pages = [];
  let consoleError;

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    consoleError.mockRestore();
    vi.useRealTimers();
    pages.forEach((page) => page.close());
    browser.close();
  });

  async function mount({
    room = roomA,
    firestore = makeFirestore(),
    storage = new MemoryStorage(),
  } = {}) {
    const page = browser.newPage();
    pages.push(page);
    const { window } = page.mainFrame;
    window.document.write(html);
    window.location.hash = room ? `#${room}` : "";
    window.confirm = vi.fn(() => true);
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    vi.spyOn(window.navigator.clipboard, "writeText").mockResolvedValue();
    const showAlert = vi.fn();
    const qrCode = { toCanvas: vi.fn(async () => {}) };
    const app = createLiveGrid({
      window,
      document: window.document,
      storage,
      firebase: firestore,
      qrCode,
      showAlert,
      debounceMs: 1,
      randomUUID: () => roomA,
    });
    await tick();
    return {
      app,
      firestore,
      page,
      qrCode,
      showAlert,
      storage,
      window,
      document: window.document,
    };
  }

  async function settle() {
    await vi.runAllTimersAsync();
    await Promise.resolve();
  }

  it("versions every local JavaScript module URL", () => {
    expect(rawHtml).toContain('src="script.js?v=3"');
    expect(rawScript).toContain('from "./app.js?v=3"');
  });

  it("creates a UUID-v4 room from the default state and repairs an invalid hash", async () => {
    const context = await mount({ room: "not-a-room" });
    await settle();

    expect(context.window.location.hash).toBe(`#${roomA}`);
    expect(context.firestore.doc).toHaveBeenCalledWith(
      context.firestore.db,
      "rooms",
      roomA,
    );
    expect(context.firestore.docs.get(`rooms/${roomA}`).name).toBe("LiveGrid");
    expect(context.storage.getItem(`livegrid:${roomA}`)).toContain(
      '"name":"LiveGrid"',
    );
  });

  it("fits the mobile grid and leaves pan and pinch zoom to the browser", async () => {
    const context = await mount();
    await settle();
    const viewport = context.document.querySelector("#grid-viewport");
    const container = context.document.querySelector("#container");
    const item = context.document.querySelector(".item");

    expect(context.document.querySelector("nav")).toBeNull();
    expect(context.document.documentElement.dataset.bsTheme).toBe("light");
    expect(
      context.document.querySelector("#gridbase").getAttribute("viewBox"),
    ).toBe("0 0 920 559");
    expect(viewport.hasAttribute("tabindex")).toBe(false);
    expect(context.document.querySelector(".zoom-controls")).toBeNull();
    expect(container.style.transform).toBe("");
    expect(context.window.getComputedStyle(viewport).touchAction).not.toBe(
      "none",
    );
    const viewportContent = context.document.querySelector(
      'meta[name="viewport"]',
    ).content;
    expect(viewportContent).not.toMatch(
      /user-scalable\s*=\s*no|maximum-scale/i,
    );
    expect(item.style.left).toBe(`${(270 / 920) * 100}%`);
    expect(item.dataset.x).toBe("270");

    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      width: 460,
      height: 279.5,
      left: 0,
      right: 460,
      top: 0,
      bottom: 279.5,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const dragStart = new context.window.Event("dragstart", { bubbles: true });
    Object.assign(dragStart, {
      clientX: 100,
      clientY: 100,
      dataTransfer: { setData: vi.fn() },
    });
    item.dispatchEvent(dragStart);
    const dragEnd = new context.window.Event("dragend", { bubbles: true });
    Object.assign(dragEnd, { clientX: 110, clientY: 105 });
    item.dispatchEvent(dragEnd);
    await settle();

    expect(item.dataset.x).toBe("290");
    expect(item.dataset.y).toBe("120");
    expect(context.firestore.docs.get(`rooms/${roomA}`).item[0]).toMatchObject({
      x: 290,
      y: 120,
    });
  });

  it("keeps axis labels and add controls clickable through the item layer", async () => {
    const context = await mount();
    await settle();
    const itemLayer = context.document.querySelector("#items");
    const item = context.document.querySelector(".item");

    expect(context.window.getComputedStyle(itemLayer).pointerEvents).toBe(
      "none",
    );
    expect(context.window.getComputedStyle(item).pointerEvents).toBe("auto");

    context.window.prompt = vi
      .fn()
      .mockReturnValueOnce("Low impact")
      .mockReturnValueOnce("Immediate");
    context.document
      .getElementById("col:0")
      .dispatchEvent(new context.window.MouseEvent("click", { bubbles: true }));
    expect(context.document.getElementById("col:0").textContent).toBe(
      "Low impact",
    );
    context.document
      .getElementById("row:new")
      .dispatchEvent(new context.window.MouseEvent("click", { bubbles: true }));
    expect(
      [...context.document.querySelectorAll('[id^="row:"]')].some(
        (node) => node.textContent === "Immediate",
      ),
    ).toBe(true);
  });

  it("keeps the complete note and its drag handle inside the grid after a drop", async () => {
    const context = await mount();
    await settle();
    const container = context.document.querySelector("#container");
    const item = context.document.querySelector(".item");
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      width: 460,
      height: 279.5,
      left: 0,
      right: 460,
      top: 0,
      bottom: 279.5,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const itemBounds = vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 40,
      left: 0,
      right: 100,
      top: 0,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const drag = (endX, endY) => {
      const start = new context.window.Event("dragstart", { bubbles: true });
      Object.assign(start, {
        clientX: 100,
        clientY: 100,
        dataTransfer: { setData: vi.fn() },
      });
      item.dispatchEvent(start);
      const end = new context.window.Event("dragend", { bubbles: true });
      Object.assign(end, { clientX: endX, clientY: endY });
      item.dispatchEvent(end);
    };

    drag(-1000, -1000);
    expect(item.dataset).toMatchObject({ x: "0", y: "40" });
    drag(1100, 1100);
    expect(item.dataset).toMatchObject({ x: "720", y: "479" });

    itemBounds.mockReturnValue({
      width: 150,
      height: 40,
      left: 0,
      right: 150,
      top: 0,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    context.window.dispatchEvent(new context.window.Event("resize"));
    expect(item.dataset).toMatchObject({ x: "620", y: "479" });
  });

  it("imports tab-delimited notes at percentage positions within the grid", async () => {
    const context = await mount();
    await settle();
    const originalCount = context.document.querySelectorAll(".item").length;
    const writesBefore = context.firestore.setDoc.mock.calls.length;
    vi.spyOn(
      context.window.HTMLElement.prototype,
      "getBoundingClientRect",
    ).mockImplementation(function () {
      if (this.id === "container") return { width: 920, height: 559 };
      if (this.classList.contains("item")) return { width: 100, height: 40 };
      return { width: 0, height: 0, left: 0 };
    });
    const input = context.document.getElementById("import-notes");
    input.value = "A\t20\t50%\nB\t30%\t0.8\nBottom\t100%\t0%\nTop\t0%\t100%";
    context.document
      .getElementById("import-form")
      .dispatchEvent(
        new context.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await settle();

    const imported = [...context.document.querySelectorAll(".item")].slice(-4);
    expect(imported.map((item) => item.textContent)).toEqual([
      "A",
      "B",
      "Bottom",
      "Top",
    ]);
    expect(imported.map((item) => Number(item.dataset.x))).toEqual([
      184, 276, 820, 0,
    ]);
    expect(Number(imported[0].dataset.y)).toBeCloseTo(279.5);
    expect(Number(imported[1].dataset.y)).toBeCloseTo(111.8);
    expect(Number(imported[2].dataset.y)).toBeCloseTo(519);
    expect(Number(imported[3].dataset.y)).toBeCloseTo(20);
    expect(input.value).toBe("");
    expect(context.firestore.setDoc).toHaveBeenCalledTimes(writesBefore + 1);

    input.value = "Good\t10\t10\nBad\tunknown\t20";
    context.document
      .getElementById("import-form")
      .dispatchEvent(
        new context.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    expect(context.document.querySelectorAll(".item")).toHaveLength(
      originalCount + 4,
    );
    expect(context.showAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Import failed" }),
    );
  });

  it("synchronizes two browsers, survives refresh, and isolates separate rooms", async () => {
    const firestore = makeFirestore();
    const first = await mount({ firestore });
    const second = await mount({ firestore });
    await settle();

    first.document.querySelector(".item").innerHTML = "Shared change";
    first.document
      .querySelector(".item")
      .dispatchEvent(new first.window.Event("focusout", { bubbles: true }));
    await settle();
    expect(second.document.querySelector(".item").textContent).toBe(
      "Shared change",
    );

    const refreshed = await mount({ firestore });
    const separate = await mount({ room: roomB, firestore });
    await settle();
    expect(refreshed.document.querySelector(".item").textContent).toBe(
      "Shared change",
    );
    expect(separate.document.querySelector(".item").textContent).not.toBe(
      "Shared change",
    );
  });

  it("keeps local edits offline and writes the latest whole document after reconnection", async () => {
    const firestore = makeFirestore();
    firestore.online = false;
    const context = await mount({ firestore });
    context.document.querySelector("#notes").innerHTML = "Offline note";
    context.document
      .querySelector("#notes")
      .dispatchEvent(new context.window.Event("focusout"));
    await settle();

    expect(context.storage.getItem(`livegrid:${roomA}`)).toContain(
      "Offline note",
    );
    expect(
      context.document.querySelector("#connection-status").textContent,
    ).toMatch(/offline/i);

    firestore.online = true;
    context.window.dispatchEvent(new context.window.Event("online"));
    await settle();
    expect(firestore.docs.get(`rooms/${roomA}`).notes).toBe("Offline note");
    expect(
      context.document.querySelector("#connection-status").textContent,
    ).toMatch(/connected/i);
  });

  it("deletes a room without recreating it when the missing snapshot arrives", async () => {
    const context = await mount();
    await settle();
    const writesBeforeDelete = context.firestore.setDoc.mock.calls.length;

    context.document.querySelector("#delete-room").click();
    await settle();

    expect(context.firestore.deleteDoc).toHaveBeenCalledOnce();
    expect(context.firestore.docs.has(`rooms/${roomA}`)).toBe(false);
    expect(context.firestore.setDoc).toHaveBeenCalledTimes(writesBeforeDelete);
    expect(
      context.document.querySelector("#connection-status").textContent,
    ).toMatch(/deleted/i);
  });

  it("reports permission, connection, and write errors while preserving local use", async () => {
    const context = await mount();
    await settle();
    context.firestore.fail(
      `rooms/${roomA}`,
      Object.assign(new Error("Denied"), { code: "permission-denied" }),
    );
    expect(
      context.document.querySelector("#connection-status").textContent,
    ).toMatch(/permission/i);

    context.firestore.online = false;
    context.document.querySelector("#notes").textContent = "Still local";
    context.document
      .querySelector("#notes")
      .dispatchEvent(new context.window.Event("focusout"));
    await settle();
    expect(context.showAlert).toHaveBeenCalled();
    expect(context.storage.getItem(`livegrid:${roomA}`)).toContain(
      "Still local",
    );
  });

  it("sanitizes malicious remote item and notes HTML before insertion", async () => {
    const firestore = makeFirestore();
    firestore.docs.set(`rooms/${roomA}`, {
      item: [
        {
          x: 10,
          y: 20,
          t: '<img src=x onerror="alert(1)"><b>Safe</b><script>bad()</script>',
          c: "red",
        },
      ],
      row: ["One"],
      col: ["Two"],
      name: "Remote",
      notes: '<a href="javascript:alert(1)" onclick="bad()">Notes</a>',
      publish_url: "",
    });
    const context = await mount({ firestore });
    await settle();

    expect(context.document.querySelector(".item b").textContent).toBe("Safe");
    expect(context.document.querySelector(".item script")).toBeNull();
    expect(
      context.document.querySelector(".item img").hasAttribute("onerror"),
    ).toBe(false);
    expect(
      context.document.querySelector("#notes a").hasAttribute("onclick"),
    ).toBe(false);
    expect(
      context.document.querySelector("#notes a").hasAttribute("href"),
    ).toBe(false);
  });

  it("shares the complete URL and renders its QR code", async () => {
    const context = await mount();
    await settle();
    context.document.querySelector("#share-room").click();
    await Promise.resolve();
    expect(context.window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      context.window.location.href,
    );

    context.document.querySelector("#show-qr").click();
    await Promise.resolve();
    expect(context.qrCode.toCanvas).toHaveBeenCalledWith(
      expect.anything(),
      context.window.location.href,
      expect.anything(),
    );
  });
});
