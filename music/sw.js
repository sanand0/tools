// @ts-check
// Only the player shell is cached. Music, playlists and history stay on disk.
const PREFIX = "music-shell-";
const META_CACHE = "music-metadata";
const stateURL = new URL("__offline_state__", self.registration.scope).href;
const candidateURL = new URL("__offline_candidate__", self.registration.scope).href;
const ASSETS = [
  "./index.html", "./script.js", "./offline.js", "./library.js",
  "./style.css", "./manifest.webmanifest", "./icon.svg",
  "../common/csv.js", "../common/download.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff2?e34853135f9e39acf64315236852cd5a",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff?e34853135f9e39acf64315236852cd5a",
  "https://cdn.jsdelivr.net/npm/bootstrap-alert@1",
  "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm",
].map((asset) => new URL(asset, self.registration.scope).href);
const shellURL = new URL("index.html", self.registration.scope).href;
const CDN_PREFIX = "https://cdn.jsdelivr.net/npm/";
const DOWNLOAD_CONCURRENCY = 4;
// Old and installing workers share storage, so coordinate across worker versions.
const serialize = (task) => self.navigator.locks.request("music-offline-shell", task);
let checkInFlight;

async function readState() {
  const cache = await caches.open(META_CACHE);
  return (await cache.match(stateURL))?.json() || { active: null, pending: null };
}
async function writeState(state) {
  const cache = await caches.open(META_CACHE);
  await cache.put(stateURL, new Response(JSON.stringify(state)));
}
async function downloadShell() {
  const assets = [];
  let next = 0;
  const worker = async () => {
    while (next < ASSETS.length) {
      const url = ASSETS[next++];
      const response = await fetch(new Request(url, {
        cache: url.startsWith(CDN_PREFIX) ? "default" : "no-store",
        signal: AbortSignal.timeout(30_000),
      }));
      if (!response.ok) throw new Error(`Cannot save ${url}: ${response.status}`);
      const body = await response.arrayBuffer();
      // The body is decoded by fetch; do not retain encoding/length headers on
      // the reconstructed response or the browser may decode it twice.
      const contentType = response.headers?.get?.("content-type");
      const headers = contentType ? { "content-type": contentType } : undefined;
      assets.push([url, new Response(body, { status: response.status, statusText: response.statusText, headers })]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, ASSETS.length) }, worker));
  return assets;
}
async function saveShell(assets) {
  const name = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const cache = await caches.open(name);
    // Wait for every write before deleting a failed generation.
    const results = await Promise.allSettled(assets.map(([url, response]) => cache.put(url, response.clone())));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    return name;
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
}
async function clearOldShells(state) {
  const metadata = await caches.open(META_CACHE);
  const candidate = await metadata.match(candidateURL);
  const keep = [state.active, state.pending, candidate && await candidate.text()];
  await Promise.all((await caches.keys()).filter((name) => name.startsWith(PREFIX) && !keep.includes(name)).map((name) => caches.delete(name)));
}
async function hasCompleteShell(name) {
  if (!name) return false;
  const cache = await caches.open(name);
  return (await Promise.all(ASSETS.map((url) => cache.match(url)))).every(Boolean);
}
async function removeObsolete(name, state) {
  if (name && name !== state.active && name !== state.pending) await caches.delete(name);
}
async function checkUpdate() {
  const assets = await downloadShell();
  const state = await readState();
  const current = state.active && await caches.open(state.active);
  const equal = await Promise.all(assets.map(async ([url, response]) => {
    const old = current && await current.match(url);
    if (!old) return false;
    const [before, after] = await Promise.all([old.arrayBuffer(), response.clone().arrayBuffer()]);
    const next = new Uint8Array(after);
    return before.byteLength === after.byteLength && new Uint8Array(before).every((byte, i) => byte === next[i]);
  }));
  if (equal.every(Boolean)) {
    // A reverted deployment supersedes an older staged update too.
    await writeState({ ...state, pending: null });
    await removeObsolete(state.pending, { ...state, pending: null });
    return "OFFLINE_READY";
  }
  const pending = await saveShell(assets);
  await writeState({ ...state, pending });
  await removeObsolete(state.pending, { ...state, pending });
  return "UPDATE_READY";
}
self.addEventListener("install", (event) => {
  event.waitUntil(serialize(async () => {
    const name = await saveShell(await downloadShell());
    const cache = await caches.open(META_CACHE);
    await cache.put(candidateURL, new Response(name));
    // Updates wait for the user's Refresh or for all old tabs to close.
  }));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(serialize(async () => {
    const metadata = await caches.open(META_CACHE);
    const candidate = await metadata.match(candidateURL);
    if (candidate) {
      const state = { active: await candidate.text(), pending: null };
      await writeState(state);
      await metadata.delete(candidateURL);
      await clearOldShells(state);
    }
    await self.clients.claim();
    for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "OFFLINE_READY" });
  }));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const root = new URL(self.registration.scope);
  const navigation = event.request.mode === "navigate" && url.origin === root.origin && [root.pathname, `${root.pathname}index.html`].includes(url.pathname);
  const key = navigation ? shellURL : url.href;
  if (!ASSETS.includes(key)) return;
  event.respondWith((async () => {
    const { active } = await readState();
    const cached = active && await (await caches.open(active)).match(key);
    return cached || fetch(event.request);
  })());
});
self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type === "CHECK_UPDATE") {
    checkInFlight ||= serialize(checkUpdate).finally(() => { checkInFlight = undefined; });
    event.waitUntil(checkInFlight.then((result) => event.source?.postMessage({ type: result }))
      .catch(() => event.source?.postMessage({ type: "UPDATE_CHECK_FAILED" })));
    return;
  }
  if (!["GET_STATUS", "APPLY_UPDATE"].includes(type)) return;
  const operation = serialize(async () => {
    const state = await readState();
    let result;
    if (type === "GET_STATUS") result = await hasCompleteShell(state.active) ? state.pending ? "UPDATE_READY" : "OFFLINE_READY" : "OFFLINE_UNAVAILABLE";
    if (type === "APPLY_UPDATE") {
      if (!await hasCompleteShell(state.pending)) throw new Error("Update is no longer available");
      const next = { active: state.pending, pending: null };
      await writeState(next);
      await removeObsolete(state.active, next);
      result = "UPDATE_APPLIED";
    }
    event.source?.postMessage({ type: result });
  }).catch(() => event.source?.postMessage({ type: type === "APPLY_UPDATE" ? "UPDATE_APPLY_FAILED" : "UPDATE_CHECK_FAILED" }));
  event.waitUntil(operation);
});
