// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import {
  AUDIO_PATTERN,
  LIBRARY_COLUMNS,
  joinCatalog,
  searchTracks,
  sortTracks,
  resolveM3U,
  shuffled,
  localTimestamp,
  similarity,
  pickSimilarTracks,
} from "./library.js";

import { tsvParse, objectsToTsv } from "../common/csv.js";

const $ = (id) => document.getElementById(id);
const audio = $("audio");
// Shortcut reference shared by Help and button tooltips.
const GLOBAL_SHORTCUTS = [
  { keys: "Ctrl+Super+Space", description: "Global play/pause" },
  { keys: "Ctrl+Super+PageUp", description: "Previous track" },
  { keys: "Ctrl+Super+PageDown", description: "Next track; add similar songs when the Queue ends" },
  { keys: "Ctrl+Super+Left", description: "Seek backward 5 seconds" },
  { keys: "Ctrl+Super+Right", description: "Seek forward 5 seconds" },
  { keys: "Ctrl+Super+M", description: "Open and focus Music in the Main Edge window" },
];
const KEYBOARD_SHORTCUTS = [
  {
    keys: "/",
    description: "Focus search and select its text",
    action: "focus-search",
  },
  {
    keys: "P",
    description: "Focus and open the playlist selector",
    action: "focus-playlists",
  },
  { keys: "?", description: "Open Help", action: "help" },
  {
    keys: "Enter (in search)",
    description: "Focus the first search result",
    action: "focus-results",
  },
  {
    keys: "↑ / ↓",
    description: "Select a visible library song",
    action: "select",
  },
  {
    keys: "Enter",
    description: "Play the selected library song now",
    action: "play-track",
  },
  {
    keys: "Ctrl+Enter",
    description: "Queue the selected library song",
    action: "queue-track",
  },
  {
    keys: "Shift+Enter",
    description: "Play the selected library song next",
    action: "play-next",
  },
  {
    keys: "Space",
    description: "Play / pause (outside inputs and buttons)",
    action: "toggle",
  },
  { keys: "Alt+←", description: "Seek backward 5 seconds", action: "backward" },
  { keys: "Alt+→", description: "Seek forward 5 seconds", action: "forward" },
  { keys: "Alt+↑", description: "Previous track", action: "previous" },
  { keys: "Alt+↓", description: "Next track", action: "next" },
  { keys: "+ / =", description: "Increase volume by 5%", action: "volume-up" },
  { keys: "−", description: "Decrease volume by 5%", action: "volume-down" },
  {
    keys: "M",
    description: "Mute / unmute without changing volume",
    action: "mute",
  },
  { keys: "R", description: "Cycle repeat off → all → one", action: "repeat" },
  {
    keys: "I",
    description: "Show info for the selected library song",
    action: "show-info",
  },
  {
    keys: "Shift+F10 / Menu key",
    description: "Open the library or queue context menu",
    action: "context",
  },
  { keys: "↑ / ↓; Home / End", description: "Navigate an open context menu" },
  {
    keys: "Enter / Space",
    description: "Activate the focused button or menu item",
  },
  {
    keys: "Tab / Shift+Tab",
    description: "Move focus; leave an open context menu",
  },
  {
    keys: "Escape",
    description:
      "Close a menu or dialog; otherwise clear search and focus the library",
    action: "clear-search",
  },
];
const shortcutFor = (action) =>
  KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.action === action)?.keys;
const speeds = [
  0.25, 0.33, 0.5, 0.75, 1, 1.25, 1.33, 1.5, 1.75, 2, 2.5, 3, 4, 5, 10,
];
let prefs = {};
try {
  prefs = JSON.parse(localStorage.getItem("music-preferences") || "{}");
} catch {
  /* Storage is optional. */
}
const state = {
  folder: null,
  tracks: [],
  playlists: [],
  queue: [],
  current: null,
  history: [],
  past: [],
  queueCurrent: null,
  muted: !!prefs.muted,
  selected: null,
  query: new URLSearchParams(location.hash.slice(1)).get("q") || "",
  playlist: "",
  sort: null,
  direction: "asc",
  repeat: ["off", "all", "one"].includes(prefs.repeat) ? prefs.repeat : "off",
  speed: speeds.includes(prefs.speed) ? prefs.speed : 1,
  volume: Number.isFinite(prefs.volume)
    ? Math.min(1, Math.max(0, prefs.volume))
    : 1,
  tab: "queue",
  limit: 200,
};
let objectURL,
  playbackToken = 0,
  activeStart = null,
  logWrites = Promise.resolve(),
  queueWrites = Promise.resolve(),
  queueDirty = false,
  commands = Promise.resolve(),
  pendingPlaylist;
let queueDrag,
  contextCommands = [],
  contextOrigin;
const publicTrack = (track) =>
  track &&
  Object.fromEntries(
    Object.entries(track).filter(
      ([key]) => !["handle", "search", "words"].includes(key),
    ),
  );
const queueIndex = () => state.queue.indexOf(state.queueCurrent);
const queueEntry = (track) => ({ track, played: false });
const queueStatus = (entry) =>
  entry === state.queueCurrent ? "current" : entry.played ? "played" : "next";
const volumeToAudio = (value) => value ** 1.2;
// Session-only resume points: update on meaningful events, expire lazily at starts.
const resumePositions = new Map();
function rememberPosition() {
  if (!state.current || !activeStart?.logged) return;
  const position = audio.currentTime;
  const duration = Number.isFinite(audio.duration)
    ? audio.duration
    : Number(state.current.duration);
  if (
    activeStart.completed ||
    !position ||
    (duration > 0 && position >= duration - 15)
  )
    resumePositions.delete(state.current.id);
  else if (resumePositions.get(state.current.id)?.position !== position)
    resumePositions.set(state.current.id, { position, updated: Date.now() });
}
const getState = () => ({
  current: state.current?.id ?? null,
  queue: state.queue.map(({ track }) => track.id),
  queueIndex: queueIndex(),
  muted: state.muted,
  selected: state.selected,
  playing: !audio.paused && !!state.current,
  repeat: state.repeat,
  speed: state.speed,
  volume: state.volume,
  position: audio.currentTime || 0,
  folder: state.folder?.name ?? null,
  filter: state.query,
  playlist: state.playlist,
});
function notify() {
  window.dispatchEvent(new CustomEvent("music-state", { detail: getState() }));
}
function savePreferences() {
  try {
    localStorage.setItem(
      "music-preferences",
      JSON.stringify({
        speed: state.speed,
        volume: state.volume,
        muted: state.muted,
        repeat: state.repeat,
        theme: document.documentElement.dataset.bsTheme,
      }),
    );
  } catch {
    /* Playback still works with storage disabled. */
  }
}
function report(message) {
  // Escape file-derived text before passing it to bootstrap-alert’s HTML body.
  const content = document.createElement("span");
  content.textContent = message;
  bootstrapAlert({
    body: content.innerHTML,
    color: "warning",
    replace: true,
    autohide: false,
  });
  const container = document.querySelector(".toast-container");
  if (container) {
    container
      .querySelectorAll(".btn-close")
      .forEach((button) =>
        button.setAttribute("aria-label", "Dismiss message"),
      );
    for (const toast of container.querySelectorAll(".toast")) {
      const close = toast.querySelector(".btn-close");
      const body = toast.querySelector(".toast-body");
      if (body) {
        body.replaceChildren(content.cloneNode(true));
        if (close) body.append(close);
      }
      toast.querySelector(".toast-header")?.remove();
      toast.addEventListener(
        "hidden.bs.toast",
        () => {
          toast.remove();
          if (
            !container.children.length &&
            container.parentElement === $("alerts")
          )
            $("alerts").replaceChildren();
        },
        { once: true },
      );
    }
    $("alerts").replaceChildren(container);
  }
}
const make = (tag, text, className = "") =>
  Object.assign(document.createElement(tag), { textContent: text, className });
function actionButton(action, label, icon, track) {
  const button = make("button", "", "btn btn-sm");
  button.type = "button";
  button.dataset.action = action;
  if (track) button.dataset.track = track.id;
  button.title = `${label}${shortcutFor(action) ? ` (${shortcutFor(action)})` : ""}`;
  button.setAttribute("aria-label", label);
  const glyph = make("i", "", `bi bi-${icon}`);
  glyph.setAttribute("aria-hidden", "true");
  button.append(glyph);
  return button;
}
const hue = (track) =>
  [...(track.album || track.title || track.path)].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 360,
    0,
  );
function artwork(track) {
  const art = make("div", "", "track-art");
  art.style.setProperty("--hue", hue(track));
  art.append(make("i", "", "bi bi-music-note"));
  art.setAttribute("aria-hidden", "true");
  return art;
}
function visibleTracks() {
  const source = state.playlist
    ? state.playlists.find((playlist) => playlist.path === state.playlist)
        ?.tracks || []
    : state.tracks;
  const found = searchTracks(source, state.query);
  return state.sort ? sortTracks(found, state.sort, state.direction) : found;
}
const durationLabel = (value) =>
  Number(value) > 0
    ? `${Math.floor(Number(value) / 60)}:${String(Math.floor(Number(value) % 60)).padStart(2, "0")}`
    : "";
function renderLibrary() {
  const focused = document.activeElement;
  const restore =
    $("library-scroll").contains(focused) &&
    (focused?.dataset.action || focused?.dataset.id)
      ? { ...focused.dataset }
      : null;
  const visible = visibleTracks();
  const columns = LIBRARY_COLUMNS.filter(
    (column) =>
      column.key === "path" ||
      visible.some(
        (track) => track[column.key] !== "" && track[column.key] != null,
      ),
  );
  const header = make("tr", "");
  for (const column of columns) {
    const cell = make("th", "");
    cell.scope = "col";
    if (state.sort === column.key)
      cell.setAttribute(
        "aria-sort",
        state.direction === "asc" ? "ascending" : "descending",
      );
    const button = make(
      "button",
      `${column.label}${state.sort === column.key ? (state.direction === "asc" ? " ↑" : " ↓") : ""}`,
    );
    button.dataset.action = "sort";
    button.dataset.value = column.key;
    cell.append(button);
    header.append(cell);
  }
  header.append(make("th", "Actions", "visually-labeled"));
  $("library-head").replaceChildren(header);
  const rows = visible.slice(0, state.limit).map((track) => {
    const row = make("tr", "");
    row.tabIndex = -1;
    row.dataset.id = track.id;
    row.classList.toggle("selected", track.id === state.selected);
    row.classList.toggle("current", track.id === state.current?.id);
    row.setAttribute("aria-selected", String(track.id === state.selected));
    for (const column of columns) {
      const value =
        column.key === "duration"
          ? durationLabel(track.duration)
          : track[column.key] || "";
      const cell = make("td", value);
      cell.dataset.column = column.key;
      cell.title = `${track[column.key] || ""} — Double-click to play now; right-click for actions or filter`;
      row.append(cell);
    }
    const actions = make("td", "", "row-actions");
    actions.append(
      actionButton(
        "play-track",
        `Play now: ${track.title}`,
        "play-fill",
        track,
      ),
      actionButton("queue-track", `Queue: ${track.title}`, "plus", track),
      actionButton("play-next", `Play next: ${track.title}`, "skip-end", track),
      actionButton("show-info", `Info: ${track.title}`, "info-circle", track),
    );
    row.append(actions);
    return row;
  });
  $("library-body").replaceChildren(...rows);
  $("count").textContent =
    `${visible.length.toLocaleString()}${state.query || state.playlist ? ` / ${state.tracks.length.toLocaleString()}` : ""} tracks`;
  $("welcome").hidden = !!state.folder;
  $("library-scroll").hidden = !state.folder;
  $("empty").hidden = visible.length > 0;
  $("empty").textContent = state.tracks.length
    ? "No matching tracks. Try fewer search terms."
    : "No audio files found. Change folder or refresh after adding files.";
  $("more").hidden = visible.length <= state.limit;
  $("more").textContent =
    `Show more (${visible.length - state.limit} remaining)`;
  if (restore)
    [...$("library-scroll").querySelectorAll("[data-action], [data-id]")]
      .find(
        (button) =>
          button.dataset.action === restore.action &&
          button.dataset.track === restore.track &&
          button.dataset.value === restore.value &&
          button.dataset.id === restore.id,
      )
      ?.focus({ preventScroll: true });
}
function renderLists() {
  closeContextMenu(false);
  $("queue-count").textContent = state.queue.length;
  $("queue-empty").hidden = !!state.queue.length;
  $("history-empty").hidden = !!state.history.length;
  $("queue-panel").hidden = state.tab !== "queue";
  $("history-panel").hidden = state.tab !== "history";
  for (const tab of ["queue", "history"])
    $(`${tab}-tab`).setAttribute("aria-selected", String(state.tab === tab));
  for (const [id, entries] of [
    [
      "queue-list",
      state.queue.map((entry, index) => ({
        ...entry,
        index,
        current: entry === state.queueCurrent,
      })),
    ],
    [
      "history-list",
      state.history
        .slice(-100)
        .reverse()
        .map((entry) => ({
          track: getTrack(entry.id) || {
            id: entry.id,
            title: entry.filename,
            path: entry.filename,
          },
          timestamp: entry.timestamp,
        })),
    ],
  ]) {
    const rows = entries.map(({ track, index, timestamp, current, played }) => {
      const row = make("li", "", "queue-row");
      if (index != null) {
        row.classList.toggle("current", !!current);
        row.classList.toggle("played", !!played && !current);
        if (current) row.setAttribute("aria-current", "true");
      }
      const label = make("button", "", "track-label");
      label.dataset.action = index != null ? "play-queue" : "play-track";
      label.dataset.track = track.id;
      label.title =
        index != null
          ? `${track.path} — Play now: Enter; right-click for queue actions; drag to reorder`
          : timestamp || track.path;
      label.disabled = !getTrack(track.id);
      label.append(
        make("strong", track.title),
        make("span", [track.album, track.year].filter(Boolean).join(" · ")),
        make(
          "span",
          timestamp
            ? new Date(timestamp).toLocaleString()
            : `${current ? "Current · " : played ? "Played · " : ""}${track.artist || track.album || track.path}`,
        ),
      );
      row.append(artwork(track), label);
      if (index != null) {
        row.dataset.index = index;
        row.draggable = true;
        row.title = "Drag to reorder; right-click for queue actions";
        label.dataset.index = index;
        const remove = actionButton(
          "remove-queue",
          `Remove ${track.title} from queue`,
          "x",
        );
        remove.dataset.index = index;
        row.append(remove);
      }
      return row;
    });
    $(id).replaceChildren(...rows);
  }
}
function renderPlayer() {
  if (state.current) {
    $("now-title").textContent = state.current.title;
    $("now-title").title = state.current.path;
    $("now-album").textContent = [state.current.album, state.current.year]
      .filter(Boolean)
      .join(" · ");
    $("now-album").title = $("now-album").textContent;
    $("now-detail").textContent =
      [
        state.current.artist,
        state.current.composer && `Composer: ${state.current.composer}`,
      ]
        .filter(Boolean)
        .join(" · ") || state.current.path;
    $("now-detail").title = $("now-detail").textContent;
    $("artwork").style.setProperty("--hue", hue(state.current));
  } else {
    $("now-title").textContent = "Choose something good";
    $("now-album").textContent = "";
    $("now-album").title = "";
    $("now-detail").title = "";
    $("now-detail").textContent = "Your next favorite is in your library.";
  }
  $("toggle").setAttribute("aria-label", audio.paused ? "Play" : "Pause");
  $("toggle").firstElementChild.className =
    `bi bi-${audio.paused ? "play-fill" : "pause-fill"}`;
  $("repeat-label").textContent = state.repeat;
  $("repeat").classList.toggle("active", state.repeat !== "off");
  $("repeat").setAttribute("aria-label", `Repeat: ${state.repeat}`);
  $("repeat").title = `Repeat: ${state.repeat} (R)`;
  $("speed").value = state.speed;
  $("volume").value = state.volume;
  $("volume-label").textContent = `${Math.round(state.volume * 100)}%`;
  $("mute").setAttribute("aria-pressed", String(state.muted));
  $("mute").setAttribute("aria-label", state.muted ? "Unmute" : "Mute");
  $("mute").title = `${state.muted ? "Unmute" : "Mute"} (M)`;
  $("mute").firstElementChild.className =
    `bi bi-volume-${state.muted || !state.volume ? "mute" : "up"}`;
}
function render() {
  renderLibrary();
  renderLists();
  renderPlayer();
  notify();
  mediaPosition();
}
function getTrack(id) {
  return (
    state.tracks.find((track) => track.id === id) ||
    (state.current?.id === id ? state.current : null) ||
    state.queue.find(({ track }) => track.id === id)?.track
  );
}

// IndexedDB holds ONE directory handle, never music metadata or history.
async function savedFolder(value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("music-folder", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handle");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handle", value ? "readwrite" : "readonly");
      const request = value
        ? tx.objectStore("handle").put(value, "root")
        : tx.objectStore("handle").get("root");
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
async function connect(change = false) {
  if (!window.showDirectoryPicker)
    throw new Error(
      "This browser cannot open a writable folder. Use current Edge or Chrome on desktop over HTTPS (or localhost).",
    );
  let folder = state.folder;
  if (!change && folder) {
    const permission = await folder.requestPermission({ mode: "readwrite" });
    if (permission !== "granted")
      throw new Error(
        "Folder permission was not granted. Click Reconnect or choose another folder.",
      );
  } else
    folder = await window.showDirectoryPicker({
      id: "music-library",
      mode: "readwrite",
      startIn: "music",
    });
  if (state.folder && folder !== state.folder) {
    state.queue = [];
    stopCurrent();
    state.past = [];
    resumePositions.clear();
    state.playlist = "";
    state.history = [];
  }
  state.folder = folder;
  try {
    await savedFolder(folder);
  } catch {
    /* Session-only access is sufficient. */
  }
  await refresh();
  if (pendingPlaylist) {
    const pending = pendingPlaylist;
    pendingPlaylist = null;
    await playM3U(pending);
  }
}
async function refresh() {
  if (!state.folder) throw new Error("Choose your Music folder first.");
  if ((await state.folder.queryPermission({ mode: "read" })) !== "granted")
    throw new Error(
      "Music folder access expired. Click Reconnect Music Folder.",
    );
  $("busy").hidden = false;
  const folder = state.folder,
    files = [],
    playlists = [],
    skipped = [];
  let catalog = "",
    readHistory = "";
  async function walk(directory, parent = "") {
    for await (const [name, handle] of directory.entries()) {
      const path = parent ? `${parent}/${name}` : name;
      try {
        if (handle.kind === "directory") await walk(handle, path);
        else if (AUDIO_PATTERN.test(name))
          files.push({ id: path, path, name, handle });
        else if (/\.m3u8?$/i.test(name)) {
          const file = await handle.getFile();
          playlists.push({
            path,
            handle,
            modified: file.lastModified,
            text: await file.text(),
          });
        } else if (path === "musicdump.csv")
          catalog = await (await handle.getFile()).text();
      } catch (error) {
        skipped.push(`${path}: ${error.message}`);
      }
    }
  }
  try {
    await walk(folder);
    await Promise.all([logWrites, queueWrites]);
    try {
      readHistory = await (
        await (await folder.getFileHandle("music-history.tsv")).getFile()
      ).text();
    } catch (error) {
      if (error.name !== "NotFoundError")
        skipped.push(`music-history.tsv: ${error.message}`);
    }
    let tracks;
    try {
      tracks = joinCatalog(files, catalog, folder.name);
    } catch (error) {
      tracks = joinCatalog(files);
      skipped.push(
        `musicdump.csv could not be read: ${error.message}. Using filenames.`,
      );
    }
    state.tracks = tracks;
    state.playlists = playlists
      .sort(
        (a, b) =>
          b.modified - a.modified ||
          a.path.localeCompare(b.path, undefined, { numeric: true }),
      )
      .map((playlist) => ({
        ...playlist,
        ...resolveM3U(playlist.text, playlist.path, tracks, folder.name),
      }));
    const byPath = new Map(tracks.map((track) => [track.path, track]));
    const resolvedHistory = resolveM3U(
      readHistory
        .split(/\r?\n/)
        .map((line) => line.split("\t")[1] || "")
        .join("\n"),
      "",
      tracks,
      folder.name,
    );
    const historyByName = new Map(
      resolvedHistory.tracks.map((track) => [track.name, track]),
    );
    const logged = readHistory.split(/\r?\n/).flatMap((line) => {
      const [timestamp, filename] = line.split("\t");
      return filename && Number.isFinite(Date.parse(timestamp))
        ? [
            {
              timestamp,
              filename,
              id:
                byPath.get(filename)?.id ||
                historyByName.get(filename)?.id ||
                null,
            },
          ]
        : [];
    });
    // Unwritten session entries (e.g. denied write permission) remain visible without another store.
    state.history = [
      ...logged,
      ...state.history.filter((entry) => entry.unwritten),
    ];
    // Re-read the interoperable queue file on refresh, including external edits.
    await readQueue(folder, byPath, skipped);
    await saveQueue();
    state.playlist = state.playlists.some(
      (playlist) => playlist.path === state.playlist,
    )
      ? state.playlist
      : "";
    $("playlist").replaceChildren(
      Object.assign(make("option", "All tracks"), { value: "" }),
      ...state.playlists.map((playlist) =>
        Object.assign(
          make("option", `${playlist.path} · ${playlist.tracks.length}`),
          { value: playlist.path },
        ),
      ),
    );
    $("playlist").value = state.playlist;
    $("folder-label").textContent = `${folder.name} / LOCAL MUSIC`;
    $("connect").textContent = "Reconnect";
    if (skipped.length)
      report(
        `Skipped ${skipped.length} unreadable items: ${skipped.slice(0, 6).join("; ")}${skipped.length > 6 ? "; see files and refresh after reconnecting" : ""}`,
      );
    state.limit = 200;
    render();
  } finally {
    $("busy").hidden = true;
  }
}
function stopCurrent() {
  rememberPosition();
  playbackToken++;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
  activeStart = null;
  state.current = null;
  state.queueCurrent = null;
  mediaPosition();
}
async function readQueue(folder, byPath, skipped) {
  let text;
  try {
    text = await (
      await (await folder.getFileHandle("queue.tsv")).getFile()
    ).text();
  } catch (error) {
    if (error.name !== "NotFoundError")
      skipped.push(`queue.tsv: ${error.message}`);
    // A session started before folder access (e.g. an OS launch) remains usable.
    state.queue = state.queue.filter((entry) => {
      entry.track = byPath.get(entry.track.path) || entry.track;
      return (
        byPath.has(entry.track.path) || entry.track.id.startsWith("launch:")
      );
    });
    if (state.queueCurrent && !state.queue.includes(state.queueCurrent))
      stopCurrent();
    if (state.queueCurrent) state.current = state.queueCurrent.track;
    if (error.name === "NotFoundError" && state.queue.length) queueDirty = true;
    return;
  }
  const rows = tsvParse(text.replace(/^\uFEFF/, ""));
  if (
    rows.columns.length !== 2 ||
    rows.columns[0] !== "path" ||
    rows.columns[1] !== "status" ||
    rows.some(
      (row) => !row.path || !["played", "current", "next"].includes(row.status),
    ) ||
    rows.filter((row) => row.status === "current").length > 1
  ) {
    skipped.push(
      "queue.tsv has invalid path/status columns. Existing contents were preserved; queue changes will replace it.",
    );
    return;
  }
  const sessionOnly = state.queue.flatMap((entry, index) =>
    entry.track.id.startsWith("launch:") ? [{ entry, index }] : [],
  );
  const previous = state.queue.filter(
      (entry) => !entry.track.id.startsWith("launch:"),
    ),
    oldCurrent = state.queueCurrent;
  state.queue = rows.flatMap((row, index) => {
    const track = byPath.get(row.path);
    if (!track) {
      skipped.push(`queue.tsv: missing ${row.path}`);
      return [];
    }
    // Keep occurrence identity across refreshes, including duplicate paths.
    const entry =
      previous[index]?.track.path === row.path
        ? previous[index]
        : queueEntry(track);
    entry.track = track;
    entry.played =
      row.status === "played" ||
      (row.status === "current" && (entry.played || !activeStart));
    return [{ entry, status: row.status }];
  });
  const restored = oldCurrent?.track.id.startsWith("launch:")
    ? oldCurrent
    : state.queue.find((item) => item.status === "current")?.entry || null;
  state.queue = state.queue.map((item) => item.entry);
  for (const { entry, index } of sessionOnly)
    state.queue.splice(Math.min(index, state.queue.length), 0, entry);
  if (oldCurrent !== restored && activeStart) stopCurrent();
  state.queueCurrent = restored;
  state.current = restored?.track || null;
  state.past = state.past.filter((entry) => state.queue.includes(entry));
  queueDirty = false;
}
function saveQueue() {
  if (!queueDirty) return queueWrites;
  queueDirty = false;
  const folder = state.folder;
  const persisted = state.queue.filter(
    ({ track }) => !track.id.startsWith("launch:"),
  );
  const text = persisted.length
    ? objectsToTsv(
        persisted.map((entry) => ({
          path: entry.track.path,
          status: queueStatus(entry),
        })),
      ) + "\n"
    : "path\tstatus\n";
  const outside = state.queue.length - persisted.length;
  queueWrites = queueWrites
    .then(async () => {
      if (!folder)
        throw new Error(
          "Choose/reconnect your Music folder to save this queue.",
        );
      const handle = await folder.getFileHandle("queue.tsv", { create: true });
      const writer = await handle.createWritable();
      try {
        await writer.write(text);
        await writer.close();
      } catch (error) {
        await writer.abort?.();
        throw error;
      }
      if (outside)
        report(
          `${outside} song(s) outside the Music folder remain in this session only; queue.tsv saves folder-relative paths.`,
        );
    })
    .catch((error) =>
      report(`Queue not saved: ${error.message}. Playback continues.`),
    );
  return queueWrites;
}
function logStart(start) {
  const entry = {
    timestamp: localTimestamp(),
    filename: start.track.name,
    id: start.track.id,
    unwritten: true,
  };
  state.history.push(entry);
  start.entry.played = true;
  renderLists();
  const folder = start.folder;
  logWrites = logWrites
    .then(async () => {
      if (!folder)
        throw new Error(
          "Choose/reconnect Music Folder to write music-history.tsv. This play remains in session history.",
        );
      const handle = await folder.getFileHandle("music-history.tsv", {
        create: true,
      });
      const file = await handle.getFile();
      // Preserve the old bytes, including other tools' entries; position uses byte size, not string length.
      const writer = await handle.createWritable({ keepExistingData: true });
      try {
        const tail = file.size ? await file.slice(-1).text() : "\n";
        const filename = entry.filename.replace(/[\t\r\n]/g, " ");
        await writer.write({
          type: "write",
          position: file.size,
          data: `${tail === "\n" ? "" : "\n"}${entry.timestamp}\t${filename}\tmusic-tool\n`,
        });
        await writer.close();
        entry.unwritten = false;
      } catch (error) {
        await writer.abort?.();
        throw error;
      }
    })
    .catch((error) =>
      report(`History not saved: ${error.message}. Playback continues.`),
    );
}
async function startTrack(
  track,
  { remember = true, entry, restart = false } = {},
) {
  if (!track)
    throw new Error(
      "Track is unavailable. Refresh the library or reconnect your folder.",
    );
  const token = ++playbackToken;
  const file = await track.handle.getFile();
  if (token !== playbackToken) return;
  rememberPosition();
  for (const [id, point] of resumePositions)
    if (Date.now() - point.updated >= 24 * 60 * 60 * 1000)
      resumePositions.delete(id);
  if (restart) resumePositions.delete(track.id);
  const position = resumePositions.get(track.id)?.position || 0;
  if (remember && state.current && activeStart?.logged)
    state.past.push(state.queueCurrent);
  audio.pause();
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = URL.createObjectURL(file);
  if (!entry) {
    entry = queueEntry(track);
    state.queue.splice(queueIndex() + 1, 0, entry);
  }
  state.queueCurrent = entry;
  state.current = track;
  activeStart = {
    track,
    entry,
    folder: state.folder,
    logged: false,
    resume: position,
  };
  queueDirty = true;
  audio.src = objectURL;
  audio.currentTime = position;
  audio.preservesPitch = true;
  try {
    audio.playbackRate = state.speed;
  } catch {
    state.speed = 1;
    report("Requested playback speed is unsupported; using 1×.");
  }
  audio.volume = volumeToAudio(state.volume);
  audio.muted = state.muted;
  render();
  try {
    await audio.play();
  } catch (error) {
    report(
      `Cannot play ${track.name}: ${error.name === "NotAllowedError" ? "autoplay was blocked. Click Play to start." : error.message + ". This file may be missing or use an unsupported format."}`,
    );
  }
}
async function next(ended = false) {
  if (ended && state.repeat === "one" && state.current)
    return startTrack(state.current, {
      remember: false,
      entry: state.queueCurrent,
      restart: true,
    });
  let position = queueIndex() + 1;
  if (
    !ended &&
    position >= state.queue.length &&
    state.repeat !== "all" &&
    state.queue.length
  ) {
    const seed = state.queue.at(-1).track;
    const tracks = pickSimilarTracks(seed, state.tracks);
    if (tracks.length) {
      state.queue.push(...tracks.map(queueEntry));
      queueDirty = true;
    } else
      report(`No similar songs found for ${seed.title || seed.name}. Queue unchanged.`);
  }
  const skipped = [];
  for (let attempt = 0; attempt < state.queue.length; attempt++, position++) {
    if (position >= state.queue.length) {
      if (state.repeat !== "all") break;
      position = 0;
    }
    const entry = state.queue[position];
    try {
      await startTrack(entry.track, { entry });
      if (skipped.length)
        report(
          `Skipped ${skipped.length} unavailable tracks: ${skipped.join("; ")}. Refresh or reconnect your library.`,
        );
      return;
    } catch (error) {
      skipped.push(`${entry.track.name}: ${error.message}`);
    }
  }
  audio.pause();
  if (skipped.length)
    report(
      `No queued files could be opened. Skipped ${skipped.length} tracks: ${skipped.slice(0, 3).join("; ")}. Refresh or reconnect your library.`,
    );
}

async function playM3U(path, options = {}) {
  const playlist =
    typeof path === "string"
      ? state.playlists.find((item) => item.path === path)
      : path;
  if (!playlist)
    throw new Error(
      `Playlist ${path} was not found. Choose your Music folder or refresh.`,
    );
  const text =
    playlist.text ?? (await (await playlist.handle.getFile()).text());
  const { tracks, missing } = resolveM3U(
    text,
    playlist.path,
    state.tracks,
    state.folder?.name,
  );
  if (missing.length)
    report(
      `${missing.length} playlist entries are inaccessible or ambiguous (${missing.slice(0, 3).join(", ")}). Select/reconnect the Music folder containing these tracks; then refresh. Accessible tracks will play.`,
    );
  if (!tracks.length) {
    if (playlist.handle) pendingPlaylist = playlist;
    throw new Error(
      "No accessible tracks in this playlist. Select/reconnect your Music folder, then refresh; the received playlist will be retried after reconnecting.",
    );
  }
  const repeat = options.repeat ?? "off";
  if (!["off", "all", "one"].includes(repeat))
    throw new Error("Repeat must be off, all or one.");
  const ordered = options.shuffle ? shuffled(tracks) : tracks;
  state.repeat = repeat;
  stopCurrent();
  state.queue = ordered.map(queueEntry);
  queueDirty = true;
  state.past = [];
  savePreferences();
  await startTrack(ordered[0], { entry: state.queue[0], remember: false });
  await saveQueue();
}
async function showInfo(track) {
  if (!track) throw new Error("Select a track first.");
  const file = await track.handle.getFile();
  const facts = {
    Path: track.path,
    Filename: file.name,
    Size: `${file.size.toLocaleString()} bytes`,
    Modified: new Date(file.lastModified).toLocaleString(),
    Type: file.type || "Unknown",
    ...track.metadata,
  };
  $("info-content").replaceChildren(
    ...Object.entries(facts)
      .filter(([, value]) => value !== "")
      .flatMap(([key, value]) => [make("dt", key), make("dd", String(value))]),
  );
  if (!$("info").open) $("info").showModal();
}
async function dispatch(command) {
  const {
    action,
    seconds = 5,
    value,
    track: trackId,
    id,
    query,
    path,
    index,
  } = command;
  // Index-based queue gestures carry a snapshot so changes during a drag/menu
  // cannot move, remove or play a different occurrence of a duplicate song.
  if (command.queueSnapshot && !sameQueue(command.queueSnapshot))
    return getState();
  const track = trackId?.handle
    ? trackId
    : getTrack(trackId ?? id ?? state.selected);
  switch (action) {
    case "play":
      if (state.current) {
        if (audio.ended) await next();
        else if (!activeStart)
          await startTrack(state.current, { entry: state.queueCurrent });
        else await audio.play();
      } else await next();
      break;
    case "pause":
      rememberPosition();
      audio.pause();
      break;
    case "toggle":
      return dispatch({ action: audio.paused ? "play" : "pause" });
    case "forward":
    case "backward":
    case "seek": {
      if (!Number.isFinite(Number(seconds)))
        throw new Error("Seek seconds must be a number.");
      const target =
        action === "seek"
          ? Number(seconds)
          : audio.currentTime +
            Number(seconds) * (action === "backward" ? -1 : 1);
      audio.currentTime = Math.max(
        0,
        Math.min(
          Number.isFinite(audio.duration) ? audio.duration : Infinity,
          target,
        ),
      );
      break;
    }
    case "next":
      await next(command.ended);
      break;
    case "previous": {
      if (state.current && audio.currentTime > 3) {
        await startTrack(state.current, {
          remember: false,
          entry: state.queueCurrent,
          restart: true,
        });
      } else {
        const previous = state.past.pop();
        if (previous)
          await startTrack(previous.track, {
            remember: false,
            entry: state.queue.includes(previous) ? previous : undefined,
          });
        else if (state.current)
          await startTrack(state.current, {
            remember: false,
            entry: state.queueCurrent,
            restart: true,
          });
      }
      break;
    }
    case "speed": {
      if (!speeds.includes(Number(value)))
        throw new Error("Choose a listed playback speed.");
      try {
        audio.playbackRate = Number(value);
        state.speed = audio.playbackRate;
      } catch {
        throw new Error(
          `This browser does not support ${value}× playback speed. Previous speed retained.`,
        );
      }
      audio.preservesPitch = true;
      savePreferences();
      break;
    }
    case "mute":
      state.muted = value == null ? !state.muted : !!value;
      audio.muted = state.muted;
      savePreferences();
      break;
    case "volume-up":
    case "volume-down":
      return dispatch({
        action: "volume",
        value:
          Math.round(
            (state.volume + (action === "volume-up" ? 0.05 : -0.05)) * 100,
          ) / 100,
      });
    case "volume": {
      if (!Number.isFinite(Number(value)))
        throw new Error("Volume must be 0–1.");
      state.volume = Math.max(0, Math.min(1, Number(value)));
      if (state.volume > 0) state.muted = false;
      audio.volume = volumeToAudio(state.volume);
      audio.muted = state.muted;
      savePreferences();
      break;
    }
    case "repeat": {
      const repeat =
        value ??
        ["off", "all", "one"][
          (["off", "all", "one"].indexOf(state.repeat) + 1) % 3
        ];
      if (!["off", "all", "one"].includes(repeat))
        throw new Error("Repeat must be off, all or one.");
      state.repeat = repeat;
      savePreferences();
      break;
    }
    case "play-track":
      await startTrack(track);
      break;
    case "queue-track":
    case "play-next":
      if (!track) throw new Error("Track not found. Refresh your library.");
      if (action === "play-next")
        state.queue.splice(queueIndex() + 1, 0, queueEntry(track));
      else state.queue.push(queueEntry(track));
      queueDirty = true;
      break;
    case "move-queue": {
      const from = Number(index);
      if (!Number.isInteger(from) || from < 0 || from >= state.queue.length)
        break;
      const destinations = {
        up: from - 1,
        down: from + 1,
        top: 0,
        bottom: state.queue.length - 1,
      };
      const target = Number(destinations[command.to] ?? command.to);
      if (!Number.isInteger(target))
        throw new Error(
          "Queue destination must be an index, up, down, top or bottom.",
        );
      const to = Math.max(0, Math.min(state.queue.length - 1, target));
      state.queue.splice(to, 0, state.queue.splice(from, 1)[0]);
      queueDirty = true;
      break;
    }
    case "play-queue": {
      const position = Number(index);
      if (
        !Number.isInteger(position) ||
        position < 0 ||
        position >= state.queue.length
      )
        break;
      const queued = state.queue[position];
      await startTrack(queued.track, { entry: queued });
      break;
    }
    case "remove-queue":
    case "remove-above":
    case "remove-below": {
      const position = Number(index);
      if (
        !Number.isInteger(position) ||
        position < 0 ||
        position >= state.queue.length
      )
        break;
      const removed =
        action === "remove-above"
          ? state.queue.splice(0, position)
          : action === "remove-below"
            ? state.queue.splice(position + 1)
            : state.queue.splice(position, 1);
      if (removed.includes(state.queueCurrent)) stopCurrent();
      state.past = state.past.filter((entry) => !removed.includes(entry));
      queueDirty = true;
      break;
    }
    case "clear-queue":
      state.queue = [];
      state.past = [];
      stopCurrent();
      queueDirty = true;
      break;
    case "shuffle-queue": {
      const position = queueIndex() + 1;
      state.queue.splice(
        position,
        state.queue.length - position,
        ...shuffled(state.queue.slice(position)),
      );
      queueDirty = true;
      break;
    }
    case "play-any": {
      const source = visibleTracks();
      if (!source.length)
        throw new Error(
          "No visible songs to play. Try another playlist or search.",
        );
      const batch = [];
      while (batch.length < 10)
        batch.push(...shuffled(source).slice(0, 10 - batch.length));
      const entries = batch.map(queueEntry);
      state.queue.push(...entries);
      queueDirty = true;
      await startTrack(entries[0].track, { entry: entries[0] });
      break;
    }
    case "shuffle-visible": {
      const tracks = shuffled(visibleTracks());
      if (!tracks.length) break;
      stopCurrent();
      state.queue = tracks.map(queueEntry);
      state.past = [];
      queueDirty = true;
      await startTrack(tracks[0], { remember: false, entry: state.queue[0] });
      break;
    }
    case "play-similar": {
      const seed = index == null ? track : state.queue[Number(index)]?.track;
      if (!seed) throw new Error("Track not found. Refresh your library.");
      const tracks = pickSimilarTracks(seed, state.tracks);
      if (!tracks.length)
        throw new Error(
          "No similar songs found in the available CSV metadata.",
        );
      state.queue.splice(queueIndex() + 1, 0, ...tracks.map(queueEntry));
      queueDirty = true;
      break;
    }
    case "locate-track": {
      const located = index == null ? track : state.queue[Number(index)]?.track;
      if (!located || !state.tracks.some((item) => item.id === located.id))
        throw new Error(
          "This song is outside the selected library. Choose its Music folder to locate it.",
        );
      const playlist = state.playlists.find(
        (item) => item.path === state.playlist,
      );
      if (playlist && !playlist.tracks.some((item) => item.id === located.id))
        state.playlist = "";
      state.query = "";
      $("search").value = "";
      history.replaceState(null, "", location.pathname + location.search);
      $("playlist").value = state.playlist;
      state.selected = located.id;
      state.limit = Math.max(
        200,
        visibleTracks().findIndex((item) => item.id === located.id) + 1,
      );
      render();
      $("library-scroll").focus({ preventScroll: true });
      [...$("library-body").children]
        .find((row) => row.dataset.id === located.id)
        ?.scrollIntoView?.({ block: "center" });
      return getState();
    }
    case "focus-search":
      $("search").focus();
      $("search").select();
      return getState();
    case "focus-results":
      state.selected = visibleTracks()[0]?.id ?? null;
      renderLibrary();
      [...$("library-body").children]
        .find((row) => row.dataset.id === state.selected)
        ?.focus({ preventScroll: true });
      notify();
      return getState();
    case "focus-playlists":
      $("playlist").focus();
      try {
        $("playlist").showPicker?.();
      } catch {
        /* Focus remains useful without activation/support. */
      }
      return getState();
    case "clear-search":
      return dispatch({ action: "filter", query: "" });
    case "filter":
      state.query = String(query ?? "");
      $("search").value = state.query;
      state.limit = 200;
      state.selected = visibleTracks()[0]?.id ?? null;
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}${state.query ? `#${new URLSearchParams({ q: state.query })}` : ""}`,
      );
      break;
    case "select":
      state.selected = track?.id ?? null;
      // Preserve row nodes between clicks: replacing them breaks native double-clicks.
      if (
        state.selected &&
        ![...$("library-body").children].some(
          (row) => row.dataset.id === state.selected,
        )
      )
        renderLibrary();
      for (const row of $("library-body").children) {
        const selected = row.dataset.id === state.selected;
        row.classList.toggle("selected", selected);
        row.setAttribute("aria-selected", String(selected));
      }
      notify();
      return getState();
    case "show-info":
      await showInfo(track);
      break;
    case "current-info":
      await showInfo(state.current);
      break;
    case "play-m3u":
      await playM3U(path, command);
      break;
    case "refresh":
      await refresh();
      break;
    case "help":
      $("help").showModal();
      break;
    case "sort":
      state.direction =
        state.sort === value && state.direction === "asc" ? "desc" : "asc";
      state.sort = value;
      break;
    case "tab":
      state.tab = value;
      break;
    case "playlist":
      state.playlist = value ?? "";
      $("playlist").value = state.playlist;
      state.sort = null;
      state.selected = null;
      state.limit = 200;
      break;
    case "play-playlist":
      if (state.playlist) await playM3U(state.playlist);
      else throw new Error("Choose a playlist first.");
      break;
    case "queue-playlist": {
      const playlist = state.playlists.find(
        (item) => item.path === state.playlist,
      );
      if (!playlist) throw new Error("Choose a playlist first.");
      state.queue.push(...playlist.tracks.map(queueEntry));
      queueDirty = true;
      if (playlist.missing.length)
        report(
          `Skipped ${playlist.missing.length} inaccessible or ambiguous playlist entries. Reconnect or refresh to resolve them.`,
        );
      break;
    }
    case "theme":
      document.documentElement.dataset.bsTheme =
        document.documentElement.dataset.bsTheme === "dark" ? "light" : "dark";
      savePreferences();
      break;
    default:
      throw new Error(`Unknown music action: ${action}`);
  }
  await saveQueue();
  render();
  return getState();
}
function control(command) {
  // Picking must run directly inside the click, before any deferred dispatcher work.
  const immediate = [
    "reconnect",
    "change-folder",
    "focus-search",
    "focus-playlists",
  ].includes(command?.action);
  const operation = ["reconnect", "change-folder"].includes(command?.action)
    ? connect(command.action === "change-folder")
    : immediate
      ? dispatch(command)
      : (commands = commands.then(() => dispatch(command)));
  const handled = operation.catch(async (error) => {
    await saveQueue();
    if (error.name !== "AbortError")
      report(
        ["NotAllowedError", "SecurityError"].includes(error.name)
          ? `File access was denied. Reconnect Music Folder or choose it again. ${error.message}`
          : error.message,
      );
    render();
    return { ...getState(), error: error.message };
  });
  if (!immediate) commands = handled;
  return handled;
}
window.music = {
  control,
  playM3U: (path, options = {}) =>
    control({ action: "play-m3u", path, ...options }),
  getState,
  similarity: (a, b) =>
    similarity(
      typeof a === "string" ? getTrack(a) : a,
      typeof b === "string" ? getTrack(b) : b,
    ),
  findSimilar: (id, options = {}) => {
    const track = getTrack(id);
    return track
      ? pickSimilarTracks(track, state.tracks, options).map(publicTrack)
      : [];
  },
  getTrack: (id) => publicTrack(getTrack(id)),
  find: (query) => searchTracks(state.tracks, query).map(publicTrack),
  getQueue: () =>
    state.queue.map((entry) => ({
      ...publicTrack(entry.track),
      status: queueStatus(entry),
      current: entry === state.queueCurrent,
    })),
  getHistory: ({ limit = 20 } = {}) =>
    (limit > 0 ? state.history.slice(-limit) : [])
      .reverse()
      .map(({ unwritten, ...entry }) => ({ ...entry })),
};
window.addEventListener("music-control", (event) => control(event.detail));
document.addEventListener("click", (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    $(close.dataset.close).close();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (button) {
    control({
      action: button.dataset.action,
      value: button.dataset.value,
      track: button.dataset.track,
      index: button.dataset.index,
    });
    $("menu").open = false;
  } else {
    const row = event.target.closest("#library-body tr");
    if (row) {
      $("library-scroll").focus({ preventScroll: true });
      control({ action: "select", id: row.dataset.id });
    }
  }
});

function sameQueue(snapshot) {
  return (
    snapshot.length === state.queue.length &&
    snapshot.every((track, index) => track === state.queue[index])
  );
}
function closeContextMenu(restore = true) {
  const menu = $("context-menu");
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  if (restore && contextOrigin?.isConnected)
    contextOrigin.focus({ preventScroll: true });
}
function openContextMenu(event, target) {
  const cell = target.closest?.("#library-body td");
  const row = target.closest?.("#library-body tr");
  const queued = target.closest?.("#queue-list .queue-row");
  if (!row && !queued) return false;
  const menu = $("context-menu");
  if (queued) {
    const index = Number(queued.dataset.index);
    const queueSnapshot = state.queue.slice();
    const command = (action, extra = {}) => ({
      action,
      index,
      queueSnapshot,
      ...extra,
    });
    contextOrigin = $("queue-list");
    menu.setAttribute("aria-label", "Queue actions");
    contextCommands = [
      { label: "Play now", command: command("play-queue") },
      {
        label: "Locate in playlist",
        command: command("locate-track"),
        disabled: !state.tracks.some(
          (track) => track.id === state.queue[index].track.id,
        ),
      },
      { label: "Play 10 similar next", command: command("play-similar") },
      {
        label: "Move up",
        command: command("move-queue", { to: "up" }),
        disabled: index === 0,
      },
      {
        label: "Move down",
        command: command("move-queue", { to: "down" }),
        disabled: index === state.queue.length - 1,
      },
      {
        label: "Move to top",
        command: command("move-queue", { to: "top" }),
        disabled: index === 0,
      },
      {
        label: "Move to bottom",
        command: command("move-queue", { to: "bottom" }),
        disabled: index === state.queue.length - 1,
      },
      { label: "Remove from queue", command: command("remove-queue") },
      {
        label: "Remove all above",
        command: command("remove-above"),
        disabled: index === 0,
      },
      {
        label: "Remove all below",
        command: command("remove-below"),
        disabled: index === state.queue.length - 1,
      },
    ];
  } else {
    const track = getTrack(row.dataset.id);
    const column =
      LIBRARY_COLUMNS.find((column) => column.key === cell?.dataset.column) ||
      LIBRARY_COLUMNS[0];
    const value = String(track?.[column.key] ?? "");
    const label =
      cell?.dataset.column === column.key ? cell.textContent : track.title;
    contextOrigin = $("library-scroll");
    menu.setAttribute("aria-label", "Library actions");
    contextCommands = [
      {
        label: `Filter ${column.label}: ${label || "(empty)"}`,
        command: { action: "filter", query: value },
        disabled: !value.trim(),
      },
      ...[
        { label: "Play now", action: "play-track" },
        { label: "Play next", action: "play-next" },
        { label: "Play at end", action: "queue-track" },
        { label: "Play 10 similar next", action: "play-similar" },
        { label: "Info", action: "show-info" },
      ].map(({ label, action }) => ({
        label,
        command: { action, track: track.id },
      })),
    ];
  }
  event.preventDefault();
  $("menu").open = false;
  menu.replaceChildren(
    ...contextCommands.map((option, index) => {
      const button = make("button", option.label);
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.tabIndex = -1;
      button.disabled = !!option.disabled;
      button.title = `${option.label} (Enter)`;
      button.dataset.contextOption = index;
      return button;
    }),
  );
  menu.hidden = false;
  const anchor = (cell || queued || row).getBoundingClientRect();
  const x = event.clientX || anchor.left;
  const y = event.clientY || anchor.bottom;
  const bounds = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - bounds.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - bounds.height - 8))}px`;
  const first = menu.querySelector("button:not(:disabled)");
  if (first) {
    first.tabIndex = 0;
    first.focus();
  } else {
    menu.tabIndex = -1;
    menu.focus();
  }
  return true;
}
document.addEventListener("contextmenu", (event) => {
  if (!openContextMenu(event, event.target)) closeContextMenu(false);
});
document.addEventListener("pointerdown", (event) => {
  if (!$("context-menu").contains(event.target)) closeContextMenu(false);
});
window.addEventListener("resize", () => closeContextMenu(false));
document.addEventListener(
  "scroll",
  (event) => {
    if (!$("context-menu").contains(event.target)) closeContextMenu(false);
  },
  true,
);
$("context-menu").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-context-option]");
  if (!button || button.disabled) return;
  const command = contextCommands[Number(button.dataset.contextOption)].command;
  closeContextMenu();
  control(command);
});
document.addEventListener(
  "keydown",
  (event) => {
    const menu = $("context-menu");
    if (!menu.hidden) {
      if (event.key === "Escape" || event.key === "Tab") {
        closeContextMenu();
        if (event.key === "Escape") event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.stopImmediatePropagation();
      const items = [...menu.querySelectorAll("button:not(:disabled)")];
      if (
        ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
        items.length
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = items.indexOf(document.activeElement);
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  items.length) %
                items.length;
        items.forEach((item, i) => (item.tabIndex = i === index ? 0 : -1));
        items[index].focus();
      }
      return;
    }
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      const focused = document.activeElement;
      const target =
        focused.closest?.("#queue-list .queue-row") ||
        (focused.id === "queue-list"
          ? $("queue-list").firstElementChild
          : focused.closest?.("#library-scroll")
            ? [...$("library-body").children].find(
                (row) => row.dataset.id === state.selected,
              )
            : null);
      if (
        target &&
        (focused.closest?.("#queue-list") ||
          focused.closest?.("#library-scroll"))
      ) {
        openContextMenu(event, target);
        event.stopImmediatePropagation();
      }
    }
  },
  true,
);
$("queue-list").addEventListener("dragstart", (event) => {
  const row = event.target.closest(".queue-row");
  if (!row || event.target.closest('[data-action="remove-queue"]')) {
    event.preventDefault();
    return;
  }
  closeContextMenu(false);
  queueDrag = {
    index: Number(row.dataset.index),
    queueSnapshot: state.queue.slice(),
  };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.index);
  row.classList.add("dragging");
});
function queueDropTarget(event) {
  const row = event.target.closest(".queue-row");
  return row
    ? Number(row.dataset.index) +
        (event.clientY >
        row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2
          ? 1
          : 0)
    : state.queue.length;
}
$("queue-list").addEventListener("dragover", (event) => {
  if (!queueDrag || !sameQueue(queueDrag.queueSnapshot)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  $("queue-list")
    .querySelectorAll(".drop-before,.drop-after")
    .forEach((row) => row.classList.remove("drop-before", "drop-after"));
  const row =
    event.target.closest(".queue-row") || $("queue-list").lastElementChild;
  row?.classList.add(
    queueDropTarget(event) > Number(row.dataset.index)
      ? "drop-after"
      : "drop-before",
  );
});
function endQueueDrag() {
  queueDrag = null;
  $("queue-list")
    .querySelectorAll(".dragging,.drop-before,.drop-after")
    .forEach((row) =>
      row.classList.remove("dragging", "drop-before", "drop-after"),
    );
}
$("queue-list").addEventListener("drop", (event) => {
  if (!queueDrag) return;
  event.preventDefault();
  const { index, queueSnapshot } = queueDrag;
  const insertion = queueDropTarget(event);
  const to = insertion > index ? insertion - 1 : insertion;
  endQueueDrag();
  control({ action: "move-queue", index, to, queueSnapshot });
});
$("queue-list").addEventListener("dragend", endQueueDrag);

$("library-body").addEventListener("dblclick", (event) => {
  if (event.target.closest("button")) return;
  const row = event.target.closest("tr");
  if (row) control({ action: "play-track", track: row.dataset.id });
});
$("search").addEventListener("input", () =>
  control({ action: "filter", query: $("search").value }),
);
$("playlist").addEventListener("change", () =>
  control({ action: "playlist", value: $("playlist").value }),
);
$("speed").addEventListener("change", () =>
  control({ action: "speed", value: Number($("speed").value) }),
);
$("volume").addEventListener("input", () =>
  control({ action: "volume", value: Number($("volume").value) }),
);
$("theme").addEventListener("click", () => control({ action: "theme" }));
$("more").addEventListener("click", () => {
  state.limit += 200;
  renderLibrary();
});
function focusShortcutSurface() {
  const library = $("library-scroll");
  if (!library.hidden) {
    library.focus({ preventScroll: true });
    return;
  }
  document.activeElement?.blur?.();
}
document.addEventListener("keydown", (event) => {
  const editable = event.target.matches?.(
    "input,textarea,select,[contenteditable]",
  );
  const dialog = document.querySelector("dialog[open]");
  if (dialog) {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
      focusShortcutSurface();
    }
    return;
  }
  if (event.target === $("search") && event.key === "Enter") {
    event.preventDefault();
    control({ action: "focus-results" });
    return;
  }
  if (event.key === "Escape") {
    if ($("menu").open) {
      $("menu").open = false;
      event.preventDefault();
      focusShortcutSurface();
      return;
    }
    event.preventDefault();
    if (state.query || $("search").value)
      control({ action: "clear-search" }).then(() => focusShortcutSurface());
    else focusShortcutSurface();
    return;
  }
  if (event.key === "/" && (!editable || event.target === $("search"))) {
    event.preventDefault();
    control({ action: "focus-search" });
    return;
  }
  if (
    !editable &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (event.key.toLowerCase() === "p" || event.key === "?")
  ) {
    event.preventDefault();
    control({ action: event.key === "?" ? "help" : "focus-playlists" });
    return;
  }
  if (
    !editable &&
    !event.target.closest?.("#menu, .player, a[href]") &&
    !event.target.matches?.("button") &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    const action = event.altKey
      ? {
          ArrowLeft: "backward",
          ArrowRight: "forward",
          ArrowUp: "previous",
          ArrowDown: "next",
        }[event.key]
      : {
          " ": "toggle",
          r: "repeat",
          i: "show-info",
          m: "mute",
          "+": "volume-up",
          "=": "volume-up",
          "-": "volume-down",
        }[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      control({ action });
      return;
    }
  }
  if (
    editable ||
    event.target.closest?.("#menu, .player, .side-panel") ||
    event.target.matches?.("button")
  )
    return;
  const visible = visibleTracks();
  if (["ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const position = visible.findIndex((track) => track.id === state.selected);
    const next =
      position < 0
        ? event.key === "ArrowDown"
          ? 0
          : visible.length - 1
        : Math.max(
            0,
            Math.min(
              visible.length - 1,
              position + (event.key === "ArrowDown" ? 1 : -1),
            ),
          );
    if (!visible[next]) return;
    state.limit = Math.max(state.limit, next + 1);
    control({ action: "select", id: visible[next].id }).then(() => {
      const row = [...$("library-body").children]
        .find((row) => row.dataset.id === state.selected);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView?.({ block: "nearest" });
    });
  } else if (event.key === "Enter" && state.selected) {
    event.preventDefault();
    control({
      action: event.shiftKey
        ? "play-next"
        : event.ctrlKey || event.metaKey
          ? "queue-track"
          : "play-track",
      track: state.selected,
    });
  }
});
window.addEventListener("hashchange", () =>
  control({
    action: "filter",
    query: new URLSearchParams(location.hash.slice(1)).get("q") || "",
  }),
);
audio.addEventListener("play", () => {
  if (activeStart?.completed) {
    // Native Play must also continue the Queue rather than replay a finished source.
    control({ action: "pause" });
    control({ action: "next" });
  } else mediaPosition();
});
audio.addEventListener("playing", () => {
  if (activeStart?.completed) return;
  if (activeStart && !activeStart.logged) {
    activeStart.logged = true;
    logStart(activeStart);
  }
  renderPlayer();
  notify();
  mediaPosition();
});
audio.addEventListener("pause", () => {
  rememberPosition();
  renderPlayer();
  notify();
  mediaPosition();
});
audio.addEventListener("ended", () => {
  if (state.current) resumePositions.delete(state.current.id);
  if (activeStart) activeStart.completed = true;
  mediaPosition();
  control({ action: "next", ended: true });
});
audio.addEventListener("error", () => {
  if (state.current)
    report(
      `Cannot decode ${state.current.name}. Try another track or format; Next skips this file.`,
    );
});
audio.addEventListener("timeupdate", mediaPosition);
audio.addEventListener("durationchange", mediaPosition);
audio.addEventListener("emptied", mediaPosition);
audio.addEventListener("seeked", () => {
  rememberPosition();
  mediaPosition();
  notify();
});
audio.addEventListener("loadedmetadata", () => {
  const position = activeStart?.resume;
  if (position) {
    const resume =
      Number.isFinite(audio.duration) && position >= audio.duration - 15
        ? 0
        : position;
    if (!resume && state.current) resumePositions.delete(state.current.id);
    audio.currentTime = resume;
  }
  if (activeStart) activeStart.resume = 0;
  mediaPosition();
});
audio.addEventListener("ratechange", () => {
  if (
    audio.playbackRate !== state.speed &&
    speeds.includes(audio.playbackRate)
  ) {
    state.speed = audio.playbackRate;
    savePreferences();
    renderPlayer();
    notify();
  }
  mediaPosition();
});
audio.addEventListener("volumechange", () => {
  // Native mute toggles retain the slider's level; invert the same gentle curve.
  const volume = audio.volume ** (1 / 1.2);
  if (Math.abs(volume - state.volume) > 0.005 || audio.muted !== state.muted) {
    state.volume = volume;
    state.muted = audio.muted;
    savePreferences();
    renderPlayer();
    notify();
  }
});

function mediaPosition() {
  if (!navigator.mediaSession) return;
  const session = navigator.mediaSession;
  if (!state.current) session.metadata = null;
  else if (
    window.MediaMetadata &&
    ["title", "artist", "album"].some(
      (key) => session.metadata?.[key] !== (state.current[key] || ""),
    )
  )
    session.metadata = new MediaMetadata({
      title: state.current.title || "",
      artist: state.current.artist || "",
      album: state.current.album || "",
    });
  session.playbackState = state.current
    ? audio.paused || audio.ended
      ? "paused"
      : "playing"
    : "none";
  if (session.setPositionState) {
    try {
      if (state.current && Number.isFinite(audio.duration) && audio.duration > 0)
        session.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: Math.min(audio.duration, Math.max(0, audio.currentTime)),
        });
      else session.setPositionState();
    } catch {
      /* Some codecs expose transient invalid positions. */
    }
  }
}
if (navigator.mediaSession) {
  for (const [action, command] of Object.entries({
    play: "play",
    pause: "pause",
    nexttrack: "next",
    previoustrack: "previous",
    seekforward: "forward",
    seekbackward: "backward",
    seekto: "seek",
  })) {
    try {
      navigator.mediaSession.setActionHandler(action, (details) =>
        control({
          action: command,
          seconds: details.seekTime ?? details.seekOffset ?? 5,
        }),
      );
    } catch {
      /* Optional browser action. */
    }
  }
}
let installPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("install").hidden = false;
});
$("install").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  $("install").hidden = true;
});
window.addEventListener("appinstalled", () => {
  $("install").hidden = true;
});
$("speed").replaceChildren(
  ...speeds.map((value) =>
    Object.assign(make("option", `${value}×`), { value }),
  ),
);
$("search").value = state.query;
document.documentElement.dataset.bsTheme =
  prefs.theme ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
audio.preservesPitch = true;
try {
  audio.playbackRate = state.speed;
} catch {
  state.speed = 1;
}
audio.volume = volumeToAudio(state.volume);
audio.muted = state.muted;
for (const [id, shortcuts] of [
  ["global-shortcuts", GLOBAL_SHORTCUTS],
  ["keyboard-shortcuts", KEYBOARD_SHORTCUTS],
]) {
  $(id).replaceChildren(
    ...shortcuts.map((shortcut) => {
      const item = make("li", "");
      item.append(
        make("kbd", shortcut.keys),
        document.createTextNode(` — ${shortcut.description}`),
      );
      return item;
    }),
  );
}
for (const button of document.querySelectorAll("[data-action]")) {
  const keys = shortcutFor(button.dataset.action);
  if (keys && button.dataset.action !== "select")
    button.title = `${button.title || button.getAttribute("aria-label") || button.textContent.trim()} (${keys})`;
}
$("search").title = "Search library (/)";
$("volume").title = "Volume (+ / = to increase; − to decrease)";
render();
const ready = (async () => {
  try {
    const folder = await savedFolder();
    if (folder) {
      state.folder = folder;
      $("connect").textContent = "Reconnect";
      if ((await folder.queryPermission({ mode: "read" })) === "granted")
        await refresh();
      else
        report(
          "Your saved Music folder needs permission. Click Reconnect to load it.",
        );
    }
  } catch {
    /* Missing IndexedDB is harmless; ask for a folder on first use. */
  }
})();
async function launchedPath(handle) {
  try {
    return await state.folder?.resolve?.(handle);
  } catch {
    return null;
  } // A revoked library must not block a directly granted launch handle.
}
window.launchQueue?.setConsumer(async ({ files = [] }) => {
  await ready;
  for (const handle of files) {
    try {
      if (/\.m3u8?$/i.test(handle.name)) {
        const relative = await launchedPath(handle);
        await control({
          action: "play-m3u",
          path: { path: relative?.join("/") || handle.name, handle },
        });
      } else if (AUDIO_PATTERN.test(handle.name)) {
        const path = await launchedPath(handle);
        const known = path && getTrack(path.join("/"));
        const track = known
          ? { ...known, handle }
          : joinCatalog([
              {
                id: `launch:${handle.name}:${Date.now()}`,
                path: handle.name,
                name: handle.name,
                handle,
              },
            ])[0];
        // Received handles grant access even when the file is outside the library.
        await control({ action: "play-track", track });
        render();
      }
    } catch (error) {
      report(`Cannot open ${handle.name}: ${error.message}`);
    }
  }
});
window.addEventListener("pagehide", () => {
  if (objectURL) URL.revokeObjectURL(objectURL);
});
