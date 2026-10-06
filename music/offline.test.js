import { afterAll, describe, expect, it, vi } from "vitest";
import { Browser } from "happy-dom";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const musicRoot = path.resolve(import.meta.dirname);
const workerSource = await fs.readFile(path.join(musicRoot, "sw.js"), "utf8");
const statusSource = await fs.readFile(
  path.join(musicRoot, "offline.js"),
  "utf8",
);

const browser = new Browser({ console });
afterAll(() => browser.close());

const request = (url, options = {}) =>
  options.mode === "navigate"
    ? { url: new URL(url, "https://music.test/music/").href, method: "GET", ...options }
    : new Request(new URL(url, "https://music.test/music/"), options);
const lockQueues = new WeakMap();

function serviceWorkerHarness({ fetchResponse, oldCache, sharedStores, failPut } = {}) {
  const stores = sharedStores || new Map();
  const messages = [];
  const client = { postMessage: (message) => messages.push(message) };
  const fetcher = vi.fn(async (input) => {
    const url = String(input.url || input);
    if (fetchResponse) return fetchResponse(url);
    return new Response(`asset:${url}`, { status: 200 });
  });
  const makeCache = (name) => ({
    async put(key, value) {
      if (failPut?.(name, String(key.url || key))) throw new Error("cache write interrupted");
      stores.get(name).set(String(key.url || key), value.clone());
    },
    async match(key) {
      return stores.get(name).get(String(key.url || key))?.clone();
    },
    async keys() {
      return [...stores.get(name).keys()].map((url) => ({ url }));
    },
    async delete(key) {
      return stores.get(name).delete(String(key.url || key));
    },
  });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      return makeCache(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      stores.delete(name);
      return true;
    },
    async match(key) {
      for (const name of [...stores.keys()].reverse()) {
        const result = await makeCache(name).match(key);
        if (result) return result;
      }
      return undefined;
    },
  };
  if (oldCache) stores.set("music-shell-old", new Map(oldCache));
  const listeners = new Map();
  const self = {
    navigator: { locks: { request(name, task) {
      const queue = lockQueues.get(stores) || Promise.resolve();
      const next = queue.catch(() => {}).then(task);
      lockQueues.set(stores, next);
      return next;
    } } },
    location: { origin: "https://music.test" },
    registration: { scope: "https://music.test/music/" },
    skipWaiting: vi.fn(async () => {}),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => []),
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const context = vm.createContext({
    Request,
    Response,
    URL,
    fetch: fetcher,
    caches,
    self,
    console,
    Date,
    AbortSignal,
  });
  vm.runInContext(workerSource, context, { filename: "sw.js" });
  const dispatch = async (type, event = {}) => {
    const waiters = [];
    const current = {
      ...event,
      source: event.source ?? client,
      waitUntil(promise) {
        waiters.push(Promise.resolve(promise));
      },
      respondWith(promise) {
        waiters.push(Promise.resolve(promise).then((response) => {
          current.response = response;
        }));
      },
    };
    await listeners.get(type)?.(current);
    await Promise.all(waiters);
    return current;
  };
  return { caches, client, dispatch, fetcher, messages, self, stores };
}

describe("Music offline shell", () => {
  it("keeps the player complete when a new worker installs during an update check", async () => {
    const sharedStores = new Map();
    const old = serviceWorkerHarness({ sharedStores });
    await old.dispatch("install");
    await old.dispatch("activate");
    let release;
    const blocked = new Promise((resolve) => { release = resolve; });
    let started;
    const downloading = new Promise((resolve) => { started = resolve; });
    old.fetcher.mockImplementationOnce(async () => {
      started();
      await blocked;
      return new Response("new page");
    });
    const checking = old.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    await downloading;
    const newer = serviceWorkerHarness({ sharedStores });
    let installed = false;
    const installation = newer.dispatch("install").then(() => { installed = true; });
    await Promise.resolve();
    expect(installed).toBe(false);
    release();
    await Promise.all([checking, installation]);
    await newer.dispatch("activate");
    await newer.dispatch("message", { data: { type: "GET_STATUS" } });
    expect(newer.messages).toContainEqual({ type: "OFFLINE_READY" });
    newer.fetcher.mockRejectedValue(new Error("flight mode"));
    const page = await newer.dispatch("fetch", { request: request("./index.html") });
    expect(await page.response.text()).toContain("asset:https://music.test/music/index.html");
  });
  it("does not offer an update when the deployed player is unchanged", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    const generations = await harness.caches.keys();
    await harness.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    expect(harness.messages).toEqual([{ type: "OFFLINE_READY" }]);
    expect(await harness.caches.keys()).toEqual(generations);
  });
  it("installs every player dependency and activates it for offline navigation", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    const names = await harness.caches.keys();
    expect(names.some((name) => name.startsWith("music-shell-") && !name.includes("pending"))).toBe(true);
    const cache = await harness.caches.open(names.find((name) => name.startsWith("music-shell-")));
    const urls = (await cache.keys()).map((item) => item.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://music.test/music/index.html",
        "https://music.test/music/script.js",
        "https://music.test/music/offline.js",
        "https://music.test/music/library.js",
        "https://music.test/music/style.css",
        "https://music.test/music/manifest.webmanifest",
        "https://music.test/music/icon.svg",
        "https://music.test/common/csv.js",
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css",
      ]),
    );
    const activated = await harness.dispatch("activate");
    expect(activated).toBeDefined();
    expect(harness.self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it("does not intercept user music files or put audio into the shell cache", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    const audio = await harness.dispatch("fetch", {
      request: request("https://music.test/music/Album/song.mp3"),
    });
    expect(audio.response).toBeUndefined();
    expect(harness.fetcher).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("song.mp3") }),
    );
    expect(harness.fetcher).not.toHaveBeenCalledWith(
      expect.stringContaining("song.mp3"),
    );
  });

  it("serves the app shell from cache after the network disappears", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    harness.fetcher.mockRejectedValue(new Error("offline"));
    const result = await harness.dispatch("fetch", {
      request: request("https://music.test/music/index.html"),
    });
    expect(await result.response.text()).toContain("asset:https://music.test/music/index.html");
  });

  it("keeps the previous generation when an update cannot stage all assets", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    const currentName = (await harness.caches.keys()).find((name) =>
      name.startsWith("music-shell-") && !name.includes("pending"),
    );
    const previous = await (await harness.caches.open(currentName)).match(
      request("https://music.test/music/script.js"),
    );
    harness.fetcher.mockImplementation(async (input) => {
      if (String(input.url).endsWith("library.js")) throw new Error("network interrupted");
      return new Response("new asset", { status: 200 });
    });
    await harness.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    expect(harness.messages).toEqual([{ type: "UPDATE_CHECK_FAILED" }]);
    const current = await (await harness.caches.open(currentName)).match(
      request("https://music.test/music/script.js"),
    );
    expect(await current.text()).toBe(await previous.text());
    expect((await harness.caches.keys()).some((name) => name.includes("stage"))).toBe(false);
  });

  it("removes superseded shell generations only after activation", async () => {
    const harness = serviceWorkerHarness({
      oldCache: [["https://music.test/music/old.js", new Response("old")]],
    });
    await harness.dispatch("install");
    expect(await harness.caches.keys()).toContain("music-shell-old");
    await harness.dispatch("activate");
    expect(await harness.caches.keys()).not.toContain("music-shell-old");
  });

  it("reports a staged update without forcing a reload until the user chooses it", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    harness.fetcher.mockImplementation(async (input) =>
      new Response(`new:${input.url}`, { status: 200 }),
    );
    await harness.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    await vi.waitFor(() => expect(harness.messages).toEqual([{ type: "UPDATE_READY" }]));
  });

  it("answers readiness and serves queried app navigation from the active shell offline", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    harness.messages.length = 0;
    await harness.dispatch("message", { data: { type: "GET_STATUS" } });
    expect(harness.messages).toEqual([{ type: "OFFLINE_READY" }]);
    harness.fetcher.mockRejectedValue(new Error("flight mode"));
    const result = await harness.dispatch("fetch", {
      request: request("https://music.test/music/?q=ambient", { mode: "navigate" }),
    });
    expect(await result.response.text()).toContain("asset:https://music.test/music/index.html");
  });

  it("persists an applied update so a restarted worker keeps playing offline", async () => {
    const sharedStores = new Map();
    const first = serviceWorkerHarness({ sharedStores });
    await first.dispatch("install");
    await first.dispatch("activate");
    first.fetcher.mockImplementation(async (input) => new Response(`changed:${input.url}`));
    await first.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    expect(first.messages).toContainEqual({ type: "UPDATE_READY" });
    first.messages.length = 0;
    const accepting = serviceWorkerHarness({ sharedStores });
    await accepting.dispatch("message", { data: { type: "APPLY_UPDATE" } });
    expect(accepting.messages).toContainEqual({ type: "UPDATE_APPLIED" });
    const restarted = serviceWorkerHarness({ sharedStores });
    restarted.messages.length = 0;
    await restarted.dispatch("message", { data: { type: "GET_STATUS" } });
    expect(restarted.messages).toEqual([{ type: "OFFLINE_READY" }]);
    restarted.fetcher.mockRejectedValue(new Error("still offline"));
    const result = await restarted.dispatch("fetch", {
      request: request("https://music.test/music/index.html"),
    });
    expect(await result.response.text()).toContain("changed:https://music.test/music/index.html");
  });

  it("deletes a partially written candidate and keeps the usable active shell", async () => {
    const harness = serviceWorkerHarness();
    await harness.dispatch("install");
    await harness.dispatch("activate");
    const active = (await harness.caches.keys()).find((name) => name.startsWith("music-shell-"));
    harness.fetcher.mockImplementation(async (input) => new Response(`changed:${input.url}`));
    const writes = new Map();
    harness.fetcher.mockImplementation(async (input) => new Response(`changed:${input.url}`));
    // Candidate writes are deliberately interrupted after the first asset.
    const broken = serviceWorkerHarness({ sharedStores: harness.stores, failPut: (name, url) => {
      const count = writes.get(name) || 0;
      writes.set(name, count + 1);
      return name.startsWith("music-shell-") && !name.includes("pending") && count > 0 && url.endsWith("library.js");
    }});
    broken.fetcher.mockImplementation(async (input) => new Response(`changed:${input.url}`));
    await broken.dispatch("message", { data: { type: "CHECK_UPDATE" } });
    expect(broken.messages).toContainEqual({ type: "UPDATE_CHECK_FAILED" });
    expect(await broken.caches.keys()).toContain(active);
    expect((await broken.caches.keys()).filter((name) => name.startsWith("music-shell-")).length).toBe(1);
  });
});

function statusHarness({ online = true, failRegister = false } = {}) {
  const page = browser.newPage();
  const document = page.mainFrame.window.document;
  document.body.innerHTML = '<div id="offline-status" hidden></div>';
  const listeners = new Map();
  const registration = {
    active: { postMessage: vi.fn() },
    waiting: null,
    installing: null,
    addEventListener(type, handler) {
      listeners.set(`registration:${type}`, handler);
    },
    update: vi.fn(async () => {}),
  };
  const navigator = {
    onLine: online,
    serviceWorker: {
      register: vi.fn(async () => {
        if (failRegister) throw new Error("registration failed");
        return registration;
      }),
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
      controller: registration.active,
      ready: Promise.resolve(registration),
    },
  };
  const window = {
    navigator,
    document,
    location: { reload: vi.fn() },
    setTimeout: vi.fn(),
    addEventListener(type, handler) {
      listeners.set(`window:${type}`, handler);
    },
  };
  const context = vm.createContext({ window: { ...window, isSecureContext: true }, navigator, document, console });
  vm.runInContext(statusSource, context, { filename: "offline.js" });
  return { document, listeners, navigator, registration, window };
}

describe("offline status journey", () => {
  it("treats the first completed installation as ready, without an update prompt", async () => {
    const harness = statusHarness();
    await vi.waitFor(() => expect(harness.listeners.get("registration:updatefound")).toEqual(expect.any(Function)));
    harness.registration.active = null;
    harness.registration.waiting = { postMessage: vi.fn() };
    let installed;
    harness.registration.installing = {
      state: "installed",
      addEventListener(type, handler) { installed = handler; },
    };
    harness.listeners.get("registration:updatefound")();
    installed();
    expect(harness.document.getElementById("offline-status").textContent).not.toContain("An update");
    harness.registration.waiting = null;
    harness.listeners.get("message")({ data: { type: "OFFLINE_READY" } });
    expect(harness.document.getElementById("offline-status").textContent).toBe("Ready for offline listening");
  });

  it("removes a stale update offer when the deployment is reverted", async () => {
    const harness = statusHarness();
    await vi.waitFor(() => expect(harness.registration.update).toHaveBeenCalled());
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    expect(status.textContent).toContain("Refresh");
    harness.listeners.get("message")({ data: { type: "OFFLINE_READY" } });
    expect(status.textContent).toBe("Ready for offline listening");
    expect(status.querySelector("button")).toBeNull();
  });
  it("shows readiness, offline and online states through normal browser events", async () => {
    const harness = statusHarness({ online: false });
    await vi.waitFor(() =>
      expect(harness.listeners.get("message")).toEqual(expect.any(Function)),
    );
    await vi.waitFor(() =>
      expect(harness.registration.active.postMessage).toHaveBeenCalledWith({
        type: "GET_STATUS",
      }),
    );
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "OFFLINE_READY" } });
    expect(status.textContent).toBe("Offline mode");
    harness.listeners.get("window:offline")();
    expect(status.textContent).toBe("Offline mode");
    harness.navigator.onLine = true;
    harness.listeners.get("message")({ data: { type: "OFFLINE_READY" } });
    expect(status.textContent).toContain("Ready for offline listening");
    harness.listeners.get("window:online")();
    expect(status.textContent).toContain("Ready for offline listening");
    expect(harness.registration.update).toHaveBeenCalled();
    expect(harness.registration.active.postMessage).toHaveBeenCalledWith({ type: "CHECK_UPDATE" });
  });

  it("offers a quiet, user-triggered refresh when an update is ready", async () => {
    const harness = statusHarness();
    await vi.waitFor(() =>
      expect(harness.listeners.get("message")).toEqual(expect.any(Function)),
    );
    await vi.waitFor(() =>
      expect(harness.registration.update).toHaveBeenCalled(),
    );
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    const refresh = status.querySelector("button");
    expect(status.textContent).toContain("An update is ready.");
    expect(refresh?.textContent).toBe("Refresh");
    expect(harness.window.location.reload).not.toHaveBeenCalled();
    refresh?.click();
    expect(harness.window.location.reload).not.toHaveBeenCalled();
    expect(harness.registration.active.postMessage).toHaveBeenCalledWith({
      type: "APPLY_UPDATE",
    });
  });

  it("lets the user defer an update without showing it again during the session", async () => {
    const harness = statusHarness();
    await vi.waitFor(() => expect(harness.listeners.get("message")).toEqual(expect.any(Function)));
    await vi.waitFor(() => expect(harness.registration.update).toHaveBeenCalled());
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    status.querySelector("button:last-child")?.click();
    expect(status.textContent).toContain("Ready for offline listening");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    expect(status.querySelector("button")).toBeNull();
  });

  it("asks a waiting worker to skip waiting, then reloads after controllerchange", async () => {
    const harness = statusHarness();
    await vi.waitFor(() => expect(harness.listeners.get("message")).toEqual(expect.any(Function)));
    await vi.waitFor(() => expect(harness.registration.update).toHaveBeenCalled());
    harness.registration.waiting = { postMessage: vi.fn() };
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    status.querySelector("button")?.click();
    expect(harness.registration.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(harness.window.location.reload).not.toHaveBeenCalled();
    harness.listeners.get("controllerchange")();
    expect(harness.window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("shows a retry when initial registration fails", async () => {
    const harness = statusHarness({ failRegister: true });
    await vi.waitFor(() => expect(harness.navigator.serviceWorker.register).toHaveBeenCalled());
    const status = harness.document.getElementById("offline-status");
    await vi.waitFor(() => expect(status.textContent).toContain("Offline setup failed"));
    expect(status.textContent).toContain("Offline setup failed");
    status.querySelector("button")?.click();
    expect(harness.navigator.serviceWorker.register).toHaveBeenCalledTimes(2);
  });

  it("rechecks a failed update before offering Refresh again", async () => {
    const harness = statusHarness();
    await vi.waitFor(() => expect(harness.listeners.get("message")).toEqual(expect.any(Function)));
    await vi.waitFor(() => expect(harness.registration.update).toHaveBeenCalled());
    const status = harness.document.getElementById("offline-status");
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    status.querySelector("button")?.click();
    const applyAttempts = harness.registration.active.postMessage.mock.calls.length;
    harness.listeners.get("message")({ data: { type: "UPDATE_APPLY_FAILED" } });
    expect(status.textContent).toContain("Could not update");
    status.querySelector("button")?.click();
    expect(harness.registration.active.postMessage).toHaveBeenCalledTimes(applyAttempts + 1);
    expect(harness.registration.active.postMessage).toHaveBeenLastCalledWith({ type: "CHECK_UPDATE" });
    harness.listeners.get("message")({ data: { type: "UPDATE_READY" } });
    status.querySelector("button")?.click();
    harness.listeners.get("message")({ data: { type: "UPDATE_APPLIED" } });
    expect(harness.window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does not claim offline readiness before setup completes", async () => {
    const harness = statusHarness({ online: false });
    await vi.waitFor(() => expect(harness.listeners.get("message")).toEqual(expect.any(Function)));
    harness.listeners.get("window:offline")();
    expect(harness.document.getElementById("offline-status").textContent).toContain("Offline setup incomplete");
  });

  it("leaves the player usable when service workers are unsupported", async () => {
    const page = browser.newPage();
    const document = page.mainFrame.window.document;
    document.body.innerHTML = '<div id="offline-status" hidden></div>';
    const window = { navigator: {}, document, addEventListener: vi.fn() };
    vm.runInNewContext(statusSource, { window, navigator: window.navigator, document, console });
    await Promise.resolve();
    expect(document.getElementById("offline-status").textContent).toContain("Offline setup needs HTTPS");
  });
});
