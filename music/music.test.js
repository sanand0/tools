import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Browser } from "happy-dom";
import fs from "node:fs/promises";
import path from "node:path";

// Keep these tests runnable without the repository's optional CDN mirror. The
// player still uses common/csv.js in production; this mock only supplies the
// tiny CSV surface the library consumes in a unit-test process.
vi.mock("../common/csv.js", () => ({
  csvParse: (text) => {
    const lines = String(text).split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const parse = (line) => {
      const cells = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"' && quoted) {
          cell += '"';
          i += 1;
        } else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) {
          cells.push(cell);
          cell = "";
        } else cell += char;
      }
      cells.push(cell);
      return cells;
    };
    const headers = parse(lines.shift());
    return Object.assign(
      lines.map((line) =>
        Object.fromEntries(
          headers.map((header, index) => [header, parse(line)[index] ?? ""]),
        ),
      ),
      { columns: headers },
    );
  },
}));

import {
  LIBRARY_COLUMNS,
  joinCatalog,
  localTimestamp,
  pickSimilarTracks,
  resolveM3U,
  similarity,
  searchTracks,
  shuffled,
  sortTracks,
} from "./library.js";

const browser = new Browser({
  console,
  settings: {
    fetch: {
      virtualServers: [
        {
          url: "https://test/",
          directory: path.resolve(import.meta.dirname, ".."),
        },
      ],
    },
  },
});
let page;
async function loadPlayer({ unsupportedMediaActions = [] } = {}) {
  page = browser.newPage();
  await page.goto("https://test/music/manifest.webmanifest");
  const html = await fs.readFile(
    path.join(import.meta.dirname, "index.html"),
    "utf8",
  );
    const window = page.mainFrame.window;
  const mediaHandlers = {};
  const mediaSession = {
    metadata: null,
    playbackState: "none",
    setActionHandler: vi.fn((action, handler) => {
      // Unsupported optional actions must not prevent Play/Pause registration.
      if (unsupportedMediaActions.includes(action))
        throw new Error("Unsupported action");
      mediaHandlers[action] = handler;
    }),
    setPositionState: vi.fn(),
  };
  Object.defineProperty(window.navigator, "mediaSession", {
    value: mediaSession,
  });
  window.MediaMetadata = class {
    constructor(metadata) {
      Object.assign(this, metadata);
    }
  };
  window.document.open();
  window.document.write(
    html.replace(
      '<script type="module" src="script.js">',
      '<script>window.launchQueue = {setConsumer(fn) {window.testLaunchConsumer = fn;}};</script><script type="module" src="script.js">',
    ),
  );
  window.document.close();
  await page.waitUntilComplete();
  return { window, document: window.document, mediaHandlers, mediaSession };
}
afterAll(() => browser.close());

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

const fileHandle = (
  path,
  contents = "",
  type = "audio/mpeg",
  modified = 1_700_000_000_000,
) => {
  const name = path.split("/").pop();
  let bytes = new TextEncoder().encode(contents);
  return {
    kind: "file",
    name,
    path,
    async getFile() {
      return new File([bytes], name, { type, lastModified: modified });
    },
    async createWritable(options = {}) {
      let pending = options.keepExistingData ? bytes.slice() : new Uint8Array();
      return {
        async write(value) {
          const position =
            typeof value === "string" ? pending.length : value.position;
          const data = new TextEncoder().encode(
            typeof value === "string" ? value : value.data,
          );
          if (typeof value !== "string") expect(position).toBe(bytes.length);
          const next = new Uint8Array(
            Math.max(pending.length, position + data.length),
          );
          next.set(pending);
          next.set(data, position);
          pending = next;
        },
        async close() {
          bytes = pending;
        },
        async abort() {},
      };
    },
    get text() {
      return new TextDecoder().decode(bytes);
    },
  };
};

const directoryHandle = (name, children = []) => {
  const byName = new Map(children.map((child) => [child.name, child]));
  return {
    kind: "directory",
    name,
    children,
    async *values() {
      for (const child of children) yield [child.name, child];
    },
    entries() {
      return this.values();
    },
    async getFileHandle(childName, { create = false } = {}) {
      if (byName.has(childName)) return byName.get(childName);
      if (!create) throw new DOMException("Not found", "NotFoundError");
      const created = fileHandle(childName);
      byName.set(childName, created);
      children.push(created);
      return created;
    },
    async getDirectoryHandle(childName) {
      const child = byName.get(childName);
      if (!child || child.kind !== "directory")
        throw new DOMException("Not found", "NotFoundError");
      return child;
    },
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
  };
};

const track = (id, values = {}) => ({
  id,
  path: values.path ?? `${id}.mp3`,
  name: values.name ?? `${id}.mp3`,
  filename: values.filename ?? values.name ?? `${id}.mp3`,
  handle: values.handle,
  metadata: values.metadata ?? {},
  title: values.title ?? "",
  artist: values.artist ?? "",
  album: values.album ?? "",
  composer: values.composer ?? "",
  genre: values.genre ?? "",
  year: values.year ?? "",
  track: values.track ?? "",
  description: values.description ?? "",
  duration: values.duration ?? "",
  search: values.search ?? "",
  words: values.words ?? [],
});

describe("music library data helpers", () => {
  it("joins CSV rows to files and keeps unlisted files with filename fallback", () => {
    const files = [
      { id: "a", path: "Tamil/Chandramukhi.mp3", name: "Chandramukhi.mp3" },
      { id: "b", path: "Loose Song.ogg", name: "Loose Song.ogg" },
    ];
    const csv = [
      "filename,TIT2,TPE1,TALB,TDRC,TRCK,TEXT,ignored",
      'Chandramukhi.mp3,"Athithom, Athithom","A R Rahman",Soundtrack,1995,03,source note,kept',
      "missing.mp3,Deleted song,Nobody,,,,,",
    ].join("\n");
    const rows = joinCatalog(files, csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Athithom, Athithom",
      artist: "A R Rahman",
      album: "Soundtrack",
      year: "1995",
      track: "03",
      description: "source note",
    });
    expect(rows[1]).toMatchObject({
      title: "Loose Song.ogg",
      path: "Loose Song.ogg",
    });
    expect(LIBRARY_COLUMNS.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        "title",
        "artist",
        "album",
        "composer",
        "genre",
        "year",
        "track",
        "description",
        "duration",
      ]),
    );
  });

  it("matches aliases, decade prefixes, punctuation and ranks exact terms", () => {
    const rows = joinCatalog(
      [
        { id: "1", path: "1.mp3", name: "Ennavale.mp3" },
        { id: "2", path: "2.mp3", name: "Rahman live.mp3" },
        { id: "3", path: "3.mp3", name: "1998 remix.mp3" },
      ],
      [
        "filename,TIT2,TPE1,TCOM,TDRC",
        "1.mp3,Ennavale,S P Balasubrahmanyam,A R Rahman,1997",
        "2.mp3,Rahman live,Someone Else,,2001",
        "3.mp3,1998 remix,S P B,A R Rahman,",
      ].join("\n"),
    );
    expect(searchTracks(rows, "rahman 199 spb").map(({ id }) => id)).toEqual([
      "1",
      "3",
    ]);
    expect(searchTracks(rows, "ennavle")[0].id).toBe("1");
  });

  it("sorts friendly fields naturally in both directions", () => {
    const rows = [
      track("b", { title: "10 Song", year: "2001" }),
      track("a", { title: "2 Song", year: "1999" }),
      track("c", { title: "Alpha", year: "" }),
    ];
    expect(sortTracks(rows, "title").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortTracks(rows, "year", "desc").map(({ id }) => id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("ranks exact album values before folded values, words and partial matches", () => {
    const rows = joinCatalog(
      ["partial", "word", "folded", "exact"].map((id) => ({ id, path: `${id}.mp3` })),
      "filename,TALB\npartial.mp3,Kochi\nword.mp3,Hello Ko\nfolded.mp3,ko\nexact.mp3,Ko",
    );
    expect(searchTracks(rows, "Ko").map(({ id }) => id)).toEqual([
      "exact", "folded", "word", "partial",
    ]);
    expect(searchTracks(rows, "ko")[0].id).toBe("folded");
  });

  it("parses and resolves forgiving M3U entries, reporting inaccessible paths", () => {
    const playlist =
      "#EXTM3U\n#EXTINF:1,ignored\n../Album/one.mp3\nfile:///music/Loose Song.ogg\nmissing.mp3\n";
    const rows = [
      track("one", { path: "Album/one.mp3", name: "one.mp3" }),
      track("loose", { path: "Loose Song.ogg", name: "Loose Song.ogg" }),
    ];
    const resolved = resolveM3U(playlist, "Playlists/New.m3u", rows, "music");
    expect(resolved.tracks.map(({ id }) => id)).toEqual(["one", "loose"]);
    expect(resolved.missing).toEqual(["missing.mp3"]);
  });

  it("prefers exact paths and refuses ambiguous basename fallbacks", () => {
    const rows = [
      track("one", { path: "A/shared.mp3", name: "shared.mp3" }),
      track("two", { path: "B/shared.mp3", name: "shared.mp3" }),
    ];
    expect(
      resolveM3U("A/shared.mp3\nshared.mp3\n", "Lists/x.m3u", rows).tracks.map(
        ({ id }) => id,
      ),
    ).toEqual(["one"]);
    expect(
      resolveM3U("A/shared.mp3\nshared.mp3\n", "Lists/x.m3u", rows).missing,
    ).toEqual(["shared.mp3"]);
  });

  it("shuffles a copy and emits a local ISO timestamp with offset", () => {
    const rows = [1, 2, 3, 4];
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(shuffled(rows)).not.toBe(rows);
    expect(rows).toEqual([1, 2, 3, 4]);
    expect(localTimestamp(new Date("2026-09-12T15:15:21.000Z"))).toMatch(
      /^2026-09-12T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/,
    );
    vi.restoreAllMocks();
  });

  it("computes explainable similarity with weighted metadata and language pairs", () => {
    const seed = track("seed", {
      title: "Kannaana Kanney",
      artist: "Singer One",
      album: "Tamil Hits",
      composer: "Composer",
      genre: "Tamil",
      year: "1998",
    });
    const candidate = track("candidate", {
      title: "Another song",
      artist: "Singer Two",
      album: "Tamil Hits",
      composer: "Composer",
      genre: "Tamil",
      year: "1999",
    });
    const result = similarity(seed, candidate);
    expect(result.score).toBeGreaterThan(0);
    expect(result.parts).toMatchObject({
      genre: expect.any(Number),
      composer: expect.any(Number),
      album: expect.any(Number),
      year: expect.any(Number),
    });
    expect(
      similarity(seed, { ...candidate, genre: "Hindi" }).score,
    ).toBeLessThan(result.score);
  });

  it("picks a positive, de-duplicated top pool with deterministic random jitter", () => {
    const seed = track("seed", {
      title: "Song",
      composer: "C",
      artist: "Singer",
      genre: "Melody",
      year: "2000",
    });
    const tracks = [
      seed,
      track("same-title", { title: "Song", composer: "C" }),
      ...Array.from({ length: 35 }, (_, index) =>
        track(`candidate-${index}`, {
          title: `Song ${index}`,
          composer: "C",
          artist: "Singer",
          genre: "Melody",
          year: "2001",
        }),
      ),
    ];
    const first = pickSimilarTracks(seed, tracks, {
      limit: 10,
      poolSize: 30,
      random: () => 0.5,
    });
    const second = pickSimilarTracks(seed, tracks, {
      limit: 10,
      poolSize: 30,
      random: () => 0.5,
    });
    expect(first).toHaveLength(10);
    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(first.map(({ id }) => id)).not.toContain("seed");
    expect(first.map(({ id }) => id)).not.toContain("same-title");
  });
});

describe("music player integration", () => {
  let window;
  let document;
  let root;
  let songs;
  let history;
  let mediaHandlers;
  let mediaSession;

  beforeEach(async () => {
    history = fileHandle("music-history.tsv", "");
    songs = [
      fileHandle("Chandramukhi.mp3", "audio", "audio/mpeg"),
      fileHandle("Second.ogg", "audio", "audio/ogg"),
      fileHandle(
        "New.m3u",
        "#EXTM3U\nTamil/Chandramukhi.mp3\nTamil/Second.ogg\n",
        "audio/x-mpegurl",
      ),
      fileHandle(
        "musicdump.csv",
        "filename,TIT2,TPE1,TALB,TCOM,TDRC,TRCK,length\nChandramukhi.mp3,Athithom,A R Rahman,Soundtrack,A R Rahman,1995,01,240\nSecond.ogg,Second Song,Another Artist,Soundtrack,Another Composer,1996,02,240\n",
        "text/csv",
      ),
    ];
    const tamil = directoryHandle("Tamil", songs);
    songs[0].path = "Tamil/Chandramukhi.mp3";
    songs[1].path = "Tamil/Second.ogg";
    root = directoryHandle("Music", [
      tamil,
      fileHandle(
        "New.m3u",
        "#EXTM3U\nTamil/Chandramukhi.mp3\nTamil/Second.ogg\n",
        "audio/x-mpegurl",
      ),
      fileHandle(
        "musicdump.csv",
        "filename,TIT2,TPE1,TALB,TCOM,TDRC,TRCK,length\nChandramukhi.mp3,Athithom,A R Rahman,Soundtrack,A R Rahman,1995,01,240\nSecond.ogg,Second Song,Another Artist,Soundtrack,Another Composer,1996,02,240\n",
        "text/csv",
      ),
      history,
    ]);
    ({ window, document, mediaHandlers, mediaSession } = await loadPlayer());
    window.showDirectoryPicker = vi.fn(async () => root);
    if (window.HTMLMediaElement?.prototype) {
      vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(
        undefined,
      );
      vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
        () => {},
      );
    }
  });

  afterEach(async () => {
    await window.music.control({ action: "pause" });
    await page.waitUntilComplete();
    await page.close();
    vi.restoreAllMocks();
  });

  const connect = async () => {
    document.querySelector("#connect").click();
    await waitFor(
      () => document.querySelector("#count")?.textContent === "2 tracks",
    );
  };

  const nativeAudio = () => {
    const audio = document.querySelector("#audio");
    Object.defineProperties(audio, {
      paused: { configurable: true, writable: true, value: true },
      ended: { configurable: true, writable: true, value: false },
      duration: { configurable: true, writable: true, value: 240 },
    });
    window.HTMLMediaElement.prototype.play.mockImplementation(async () => {
      audio.paused = false;
      audio.ended = false;
      audio.dispatchEvent(new window.Event("play"));
      audio.dispatchEvent(new window.Event("playing"));
    });
    window.HTMLMediaElement.prototype.pause.mockImplementation(() => {
      audio.paused = true;
      audio.dispatchEvent(new window.Event("pause"));
    });
    return audio;
  };

  it("uses Media Session handlers for playback, track navigation and seeks", async () => {
    await connect();
    const audio = nativeAudio();
    expect(Object.keys(mediaHandlers)).toEqual([
      "play", "pause", "nexttrack", "previoustrack", "seekforward", "seekbackward", "seekto",
    ]);
    await window.music.control({ action: "queue-track", track: "Tamil/Chandramukhi.mp3" });
    await window.music.control({ action: "queue-track", track: "Tamil/Second.ogg" });
    await mediaHandlers.play({});
    expect(window.music.getState()).toMatchObject({ current: "Tamil/Chandramukhi.mp3", playing: true });
    expect(mediaSession.metadata).toMatchObject({ title: "Athithom", artist: "A R Rahman", album: "Soundtrack" });
    expect(mediaSession.playbackState).toBe("playing");
    await mediaHandlers.pause({});
    expect(audio.paused).toBe(true);
    expect(mediaSession.playbackState).toBe("paused");
    await mediaHandlers.play({});
    await mediaHandlers.seekforward({ seekOffset: 17 });
    expect(audio.currentTime).toBe(17);
    await mediaHandlers.seekbackward({});
    expect(audio.currentTime).toBe(12);
    await mediaHandlers.seekto({ seekTime: 0 });
    expect(audio.currentTime).toBe(0);
    await mediaHandlers.seekto({ seekTime: 500 });
    expect(audio.currentTime).toBe(240);
    await mediaHandlers.seekto({ seekTime: 0 });
    await mediaHandlers.nexttrack({});
    expect(mediaSession.metadata.title).toBe("Second Song");
    await mediaHandlers.previoustrack({});
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
    expect(window.music.getQueue()).toHaveLength(2);
  });

  it("keeps supported Media Session handlers when an optional action is unavailable", async () => {
    const previousPage = page;
    const player = await loadPlayer({ unsupportedMediaActions: ["seekto"] });
    try {
      expect(Object.keys(player.mediaHandlers)).toEqual([
        "play", "pause", "nexttrack", "previoustrack", "seekforward", "seekbackward",
      ]);
      expect(typeof player.window.music.control).toBe("function");
    } finally {
      await page.close();
      page = previousPage;
    }
  });

  it("toggles through the dispatcher without focus, resuming or starting the queue", async () => {
    await connect();
    const audio = nativeAudio();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    Object.defineProperty(document, "visibilityState", { value: "hidden" });
    await window.music.control({ action: "toggle" });
    expect(window.music.getState().current).toBeNull();
    await window.music.control({ action: "queue-track", track: "Tamil/Chandramukhi.mp3" });
    await window.music.control({ action: "queue-track", track: "Tamil/Second.ogg" });
    await window.music.control({ action: "toggle" });
    expect(audio.paused).toBe(false);
    audio.currentTime = 32;
    await window.music.control({ action: "toggle" });
    expect(audio.paused).toBe(true);
    await window.music.control({ action: "toggle" });
    expect(window.music.getState()).toMatchObject({ current: "Tamil/Chandramukhi.mp3", position: 32, playing: true });
    expect(window.music.getHistory()).toHaveLength(1);
    await Promise.all([
      window.music.control({ action: "toggle" }),
      window.music.control({ action: "toggle" }),
    ]);
    expect(audio.paused).toBe(false);
    // The Ubuntu shortcut is not registered as a page keyboard shortcut.
    document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", ctrlKey: true, metaKey: true, bubbles: true }));
    await flush();
    expect(audio.paused).toBe(false);
  });

  it("synchronizes Media Session with native audio events and clears stale state", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.playM3U("New.m3u");
    audio.paused = true;
    audio.dispatchEvent(new window.Event("pause"));
    expect(mediaSession.playbackState).toBe("paused");
    audio.paused = false;
    audio.dispatchEvent(new window.Event("play"));
    expect(mediaSession.playbackState).toBe("playing");
    audio.currentTime = 83;
    audio.dispatchEvent(new window.Event("seeked"));
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith({ duration: 240, playbackRate: 1, position: 83 });
    audio.playbackRate = 1.5;
    audio.dispatchEvent(new window.Event("ratechange"));
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith({ duration: 240, playbackRate: 1.5, position: 83 });
    audio.duration = NaN;
    audio.dispatchEvent(new window.Event("emptied"));
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith();
    audio.duration = 120;
    audio.dispatchEvent(new window.Event("durationchange"));
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith({ duration: 120, playbackRate: 1.5, position: 83 });
    audio.ended = true;
    audio.paused = true;
    audio.dispatchEvent(new window.Event("ended"));
    expect(mediaSession.playbackState).toBe("paused");
    await waitFor(() => window.music.getState().current === "Tamil/Second.ogg");
    expect(mediaSession.metadata.title).toBe("Second Song");
    audio.ended = true;
    audio.paused = true;
    audio.currentTime = audio.duration;
    audio.dispatchEvent(new window.Event("ended"));
    await window.music.control({ action: "seek", seconds: audio.duration });
    expect(window.music.getState()).toMatchObject({ queueIndex: 1, playing: false });
    expect(window.music.getQueue()).toHaveLength(2);
    expect(mediaSession.metadata.title).toBe("Second Song");
    expect(mediaSession.playbackState).toBe("paused");
    await window.music.control({ action: "clear-queue" });
    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(mediaSession.setPositionState).toHaveBeenLastCalledWith();
  });

  const waitFor = async (predicate) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await flush();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(
      `Timed out waiting for music UI state (count=${document.querySelector("#count")?.textContent}, alert=${document.querySelector("#alerts")?.textContent}, welcome=${document.querySelector("#welcome")?.hidden}, state=${JSON.stringify(window.music?.getState?.())})`,
    );
  };

  it("connects through a user gesture, renders catalog rows, and plays with Enter", async () => {
    await connect();
    expect(window.showDirectoryPicker).toHaveBeenCalledWith({
      id: "music-library",
      mode: "readwrite",
      startIn: "music",
    });
    expect(document.querySelectorAll("#library-body tr[data-id]")).toHaveLength(
      2,
    );
    const search = document.querySelector("#search");
    search.focus();
    search.value = "rahman 199";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    await waitFor(
      () => document.querySelectorAll("#library-body tr[data-id]").length === 1,
    );
    search.blur();
    const library = document.querySelector("#library-scroll");
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await waitFor(() => document.querySelector("#library-body tr.selected"));
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await waitFor(
      () => window.music.getState().current === "Tamil/Chandramukhi.mp3",
    );
    expect(window.music.getQueue()).toHaveLength(1);
    expect(document.querySelector("#now-title").textContent).toBe("Athithom");
  });

  it("orders Duration before Track and exposes the compact menu/shortcut affordances", async () => {
    await connect();
    const headings = [
      ...document.querySelectorAll("#library-head th button"),
    ].map((button) => button.textContent.replace(/[↑↓]/g, "").trim());
    expect(headings.indexOf("Duration")).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf("Track")).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf("Duration")).toBeLessThan(
      headings.indexOf("Track"),
    );
    const menu = document.querySelector("#menu .menu-panel");
    expect(menu.firstElementChild.textContent).toContain("Refresh");
    expect(
      [...menu.querySelectorAll("button")].map((button) => button.textContent),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Refresh"),
        expect.stringContaining("Help"),
      ]),
    );
    const library = document.querySelector("#library-scroll");
    library.focus();
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "?", bubbles: true }),
    );
    await flush();
    expect(document.querySelector("#help").open).toBe(true);
  });

  it("renders now-playing album/year separately and exposes similar-track lookup", async () => {
    await connect();
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(document.querySelector("#now-album").textContent).toContain(
      "Soundtrack",
    );
    expect(document.querySelector("#now-album").textContent).toContain("1995");
    expect(document.querySelector("#now-detail").textContent).toContain(
      "A R Rahman",
    );
    expect(document.querySelector("#now-detail").textContent).toContain(
      "Composer: A R Rahman",
    );
    expect(typeof window.music.findSimilar).toBe("function");
    expect(
      Array.isArray(window.music.findSimilar("Tamil/Chandramukhi.mp3")),
    ).toBe(true);
  });

  it("supports slash search focus, clear-search/Escape, picker P and Help ? shortcuts", async () => {
    await connect();
    const library = document.querySelector("#library-scroll");
    const search = document.querySelector("#search");
    search.value = "rahman";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    await waitFor(() => window.music.getState().filter === "rahman");
    library.focus();
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "/",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe(search.value.length);
    const clear = document.querySelector("#clear-search");
    expect(clear).toBeTruthy();
    clear.click();
    await waitFor(() => window.music.getState().filter === "");
    search.value = "rahman";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    search.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await waitFor(() => window.music.getState().filter === "");
    const playlistPicker = document.querySelector("#playlist");
    playlistPicker.showPicker = vi.fn();
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "P",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(playlistPicker.showPicker).toHaveBeenCalledTimes(1);
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "?", bubbles: true }),
    );
    await flush();
    expect(document.querySelector("#help").open).toBe(true);
  });

  it("returns focus from native controls so Space resumes the player shortcut", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    await waitFor(() => !audio.paused);

    const controls = [
      document.querySelector("#theme"),
      document.querySelector("#playlist"),
      audio,
      document.querySelector(".navbar-brand"),
    ];
    for (const control of controls) {
      control.focus();
      expect(document.activeElement).toBe(control);
      control.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      await flush();
      expect(document.activeElement).toBe(document.querySelector("#library-scroll"));

      document.querySelector("#library-scroll").dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitFor(() => audio.paused);
      document.querySelector("#library-scroll").dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitFor(() => !audio.paused);
    }
  });

  it("selects the first search result and uses Enter to focus results before playing", async () => {
    await connect();
    await window.music.control({ action: "select", id: "Tamil/Second.ogg" });
    const search = document.querySelector("#search");
    const key = (value) => document.activeElement.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
    );
    search.focus();
    search.value = "soundtrack";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    // Enter must wait for the pending search, rather than using its old selection.
    key("Enter");
    await waitFor(() => document.activeElement.dataset.id === "Tamil/Chandramukhi.mp3");
    expect(window.music.getState().selected).toBe("Tamil/Chandramukhi.mp3");
    expect(document.querySelector('tr[aria-selected="true"]').dataset.id).toBe("Tamil/Chandramukhi.mp3");
    expect(window.music.getState().current).toBeNull();
    key("ArrowDown");
    await waitFor(() => document.activeElement.dataset.id === "Tamil/Second.ogg");
    expect(window.music.getState().selected).toBe("Tamil/Second.ogg");
    key("ArrowUp");
    await waitFor(() => document.activeElement.dataset.id === "Tamil/Chandramukhi.mp3");
    key("Enter");
    await waitFor(() => window.music.getState().current === "Tamil/Chandramukhi.mp3");
    expect(document.activeElement.dataset.id).toBe("Tamil/Chandramukhi.mp3");
    search.focus();
    search.value = "second";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    await waitFor(() => window.music.getState().selected === "Tamil/Second.ogg");
    expect(document.activeElement).toBe(search);
    search.value = "no match";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    key("Enter");
    await waitFor(() => window.music.getState().selected === null);
    expect(document.activeElement).toBe(search);
    expect(window.music.getQueue()).toHaveLength(1);
    await window.music.control({ action: "clear-search" });
    expect(window.music.getState().selected).toBe("Tamil/Chandramukhi.mp3");
  });

  it("orders playlists by newest file modification and locates within the selected playlist", async () => {
    const old = fileHandle(
      "Old.m3u",
      "#EXTM3U\nTamil/Second.ogg\n",
      "audio/x-mpegurl",
      1_600_000_000_000,
    );
    const current = await root.getFileHandle("New.m3u");
    const tamil = await root.getDirectoryHandle("Tamil");
    const catalog = await root.getFileHandle("musicdump.csv");
    tamil.children.push(fileHandle("Loose.mp3", "audio"));
    current.getFile = async () =>
      new File([current.text], current.name, {
        type: "audio/x-mpegurl",
        lastModified: 1_700_000_000_000,
      });
    root.entries = function* entries() {
      for (const child of [tamil, old, current, catalog, history])
        yield [child.name, child];
    };
    document.querySelector("#connect").click();
    await waitFor(
      () => document.querySelector("#count")?.textContent === "3 tracks",
    );
    const options = [...document.querySelectorAll("#playlist option")].map(
      (option) => option.value,
    );
    expect(options.indexOf("New.m3u")).toBeLessThan(options.indexOf("Old.m3u"));
    await window.music.control({ action: "playlist", value: "New.m3u" });
    await window.music.control({ action: "filter", query: "no match" });
    await window.music.control({
      action: "locate-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(window.music.getState().playlist).toBe("New.m3u");
    expect(window.music.getState().filter).toBe("");
    expect(window.music.getState().selected).toBe("Tamil/Chandramukhi.mp3");
    await window.music.control({
      action: "locate-track",
      track: "Tamil/Loose.mp3",
    });
    expect(window.music.getState().playlist).toBe("");
  });

  it("reveals a located track beyond the initial 200-row window", async () => {
    const tamil = await root.getDirectoryHandle("Tamil");
    for (let index = 0; index < 205; index += 1)
      tamil.children.push(fileHandle(`Song-${index}.mp3`, "audio"));
    document.querySelector("#connect").click();
    await waitFor(
      () => document.querySelector("#count")?.textContent === "207 tracks",
    );
    await window.music.control({
      action: "locate-track",
      track: "Tamil/Song-204.mp3",
    });
    await waitFor(
      () => window.music.getState().selected === "Tamil/Song-204.mp3",
    );
    expect(
      document.querySelector('#library-body tr[data-id="Tamil/Song-204.mp3"]'),
    ).toBeTruthy();
  });

  it("remembers a real paused position when replaying the same track", async () => {
    await connect();
    const audio = document.querySelector("#audio");
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    audio.dispatchEvent(new window.Event("playing"));
    audio.currentTime = 42;
    audio.dispatchEvent(new window.Event("pause"));
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(audio.currentTime).toBeCloseTo(42);
  });

  it("drops resume memory after 24 hours and within the final 15 seconds", async () => {
    await connect();
    const audio = document.querySelector("#audio");
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    audio.dispatchEvent(new window.Event("playing"));
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 100,
    });
    audio.currentTime = 90;
    audio.dispatchEvent(new window.Event("pause"));
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(audio.currentTime).toBe(0);

    audio.dispatchEvent(new window.Event("playing"));
    audio.currentTime = 42;
    audio.dispatchEvent(new window.Event("pause"));
    await window.music.control({
      action: "play-track",
      track: "Tamil/Second.ogg",
    });
    audio.dispatchEvent(new window.Event("playing"));
    const now = window.Date.now();
    const clock = vi
      .spyOn(window.Date, "now")
      .mockReturnValue(now + 25 * 60 * 60 * 1000);
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(audio.currentTime).toBe(0);
    clock.mockRestore();
  });

  it("expires an unchanged paused resume point and validates it against decoded duration", async () => {
    await connect();
    const audio = document.querySelector("#audio");
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    audio.dispatchEvent(new window.Event("playing"));
    audio.currentTime = 42;
    audio.dispatchEvent(new window.Event("pause"));
    const clock = vi
      .spyOn(window.Date, "now")
      .mockReturnValue(window.Date.now() + 25 * 60 * 60 * 1000);
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(audio.currentTime).toBe(0);
    clock.mockRestore();
    audio.dispatchEvent(new window.Event("playing"));
    audio.currentTime = 42;
    audio.dispatchEvent(new window.Event("pause"));
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(audio.currentTime).toBe(42);
    Object.defineProperty(audio, "duration", { configurable: true, value: 50 });
    audio.dispatchEvent(new window.Event("loadedmetadata"));
    expect(audio.currentTime).toBe(0);
  });

  it("inserts up to ten similar tracks after the current track without interrupting it", async () => {
    await connect();
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    const current = window.music.getState().current;
    const future = await window.music.findSimilar(current);
    expect(future.map(({ id }) => id)).toContain("Tamil/Second.ogg");
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Second.ogg",
    });
    await window.music.control({ action: "play-similar", track: current });
    expect(window.music.getState().current).toBe(current);
    expect(window.music.getQueue().map(({ id }) => id)).toEqual([
      current,
      "Tamil/Second.ogg",
      "Tamil/Second.ogg",
    ]);
    expect((await root.getFileHandle("queue.tsv")).text).toBe(
      "path\tstatus\nTamil/Chandramukhi.mp3\tcurrent\nTamil/Second.ogg\tnext\nTamil/Second.ogg\tnext\n",
    );
    expect(typeof window.music.findSimilar).toBe("function");
    document
      .querySelector('#library-body tr[data-id="Tamil/Chandramukhi.mp3"]')
      .dispatchEvent(
        new window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
    const similarButton = [
      ...document.querySelectorAll("#context-menu button"),
    ].find((button) => button.textContent.includes("similar"));
    expect(similarButton).toBeTruthy();
    similarButton.click();
    await waitFor(() => window.music.getQueue().length === 4);
    document.querySelector("#queue-list .queue-row").dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    [...document.querySelectorAll("#context-menu button")]
      .find((button) => button.textContent === "Play 10 similar next")
      .click();
    await waitFor(() => window.music.getQueue().length === 5);
    expect(window.music.getState().current).toBe(current);
  });

  it.each(["next", "play", "toggle", "media-play"])("extends an exhausted queue with ten similar songs via %s and starts the batch", async (action) => {
    const catalog = await root.getFileHandle("musicdump.csv");
    const writer = await catalog.createWritable();
    const rows = [
      "filename,TIT2,TPE1,TALB,TCON",
      "Chandramukhi.mp3,First,Unrelated,First,Jazz",
      "Second.ogg,Latest,Related,Latest,Tamil",
    ];
    for (let i = 0; i < 12; i++) {
      root.children.push(fileHandle(`Similar-${i}.mp3`, "audio"));
      rows.push(`Similar-${i}.mp3,Similar ${i},Related,Other,Tamil`);
    }
    await writer.write(rows.join("\n"));
    await writer.close();
    document.querySelector("#connect").click();
    await waitFor(() => document.querySelector("#count").textContent === "14 tracks");
    const audio = nativeAudio();
    await window.music.playM3U("New.m3u");
    await mediaHandlers.nexttrack({});
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    const prefix = window.music.getQueue();
    audio.paused = true;
    audio.ended = true;
    audio.currentTime = audio.duration;
    audio.dispatchEvent(new window.Event("ended"));
    await window.music.control({ action: "seek", seconds: audio.duration });
    expect(window.music.getQueue()).toEqual(prefix);
    expect(window.music.getState()).toMatchObject({ queueIndex: 1, playing: false });
    expect(window.music.getHistory()).toHaveLength(2);
    if (action === "next") document.querySelector('[data-action="next"]').click();
    else {
      if (action === "media-play") await mediaHandlers.play({});
      else if (action === "toggle") document.querySelector('[data-action="toggle"]').click();
      else await window.music.control({ action });
    }
    await waitFor(() => window.music.getQueue().length === 12);
    await window.music.control({ action: "seek", seconds: 0 });
    const queue = window.music.getQueue();
    expect(queue.slice(0, 2).map(({ id }) => id)).toEqual(prefix.map(({ id }) => id));
    expect(queue.slice(2).every(({ id }) => id.startsWith("Similar-"))).toBe(true);
    expect(new Set(queue.slice(2).map(({ id }) => id)).size).toBe(10);
    expect(window.music.getState()).toMatchObject({ queueIndex: 2, current: queue[2].id, playing: true });
    expect(audio.paused).toBe(false);
    const saved = (await root.getFileHandle("queue.tsv")).text;
    expect(saved.split("\n").filter(Boolean)).toHaveLength(13);
    expect(saved).toContain(`${queue[2].path}\tcurrent`);
    await mediaHandlers.nexttrack({});
    expect(window.music.getQueue()).toHaveLength(12);
    expect(window.music.getState().queueIndex).toBe(3);
  });

  it("leaves an exhausted queue intact and pauses when no similar songs are available", async () => {
    await connect();
    const audio = nativeAudio();
    await window.testLaunchConsumer({ files: [fileHandle("Outside.mp3", "audio")] });
    await window.music.control({ action: "next" });
    expect(window.music.getQueue()).toHaveLength(1);
    expect(audio.paused).toBe(true);
    expect(document.querySelector("#alerts").textContent).toContain("No similar songs");
    expect(mediaSession.playbackState).toBe("paused");
    await window.music.control({ action: "clear-queue" });
    await window.music.control({ action: "next" });
    expect(window.music.getQueue()).toEqual([]);
  });

  it("continues the Queue on native Play after completion without logging a replay", async () => {
    const catalog = await root.getFileHandle("musicdump.csv");
    let writer = await catalog.createWritable();
    await writer.write("filename,TIT2,TPE1\nSecond.ogg,Second Song,Unique Artist\n");
    await writer.close();
    await connect();
    const audio = nativeAudio();
    await window.music.control({ action: "play-track", track: "Tamil/Second.ogg" });
    audio.paused = true;
    audio.ended = true;
    audio.currentTime = audio.duration;
    audio.dispatchEvent(new window.Event("ended"));
    await window.music.control({ action: "pause" });
    expect(window.music.getHistory()).toHaveLength(1);
    // A catalog refresh makes a recommendation available after completion.
    writer = await catalog.createWritable();
    await writer.write("filename,TIT2,TPE1\nSecond.ogg,Second Song,Unique Artist\nChandramukhi.mp3,Athithom,Unique Artist\n");
    await writer.close();
    await window.music.control({ action: "refresh" });
    await audio.play();
    await waitFor(() => window.music.getState().current === "Tamil/Chandramukhi.mp3");
    expect(window.music.getState()).toMatchObject({ queueIndex: 1, playing: true });
    expect(window.music.getQueue()).toHaveLength(2);
    expect(window.music.getHistory()).toHaveLength(2);
  });

  it("uses one dispatcher for custom controls, repeat, speed, volume and state events", async () => {
    await connect();
    const states = [];
    window.addEventListener("music-state", (event) =>
      states.push(event.detail),
    );
    window.dispatchEvent(
      new window.CustomEvent("music-control", {
        detail: { action: "queue-track", track: "Tamil/Second.ogg" },
      }),
    );
    await waitFor(() => window.music.getQueue().length === 1);
    await window.music.control({ action: "speed", value: 1.5 });
    await window.music.control({ action: "volume", value: 0.25 });
    await window.music.control({ action: "repeat", value: "all" });
    expect(window.music.getState()).toMatchObject({
      speed: 1.5,
      volume: 0.25,
      repeat: "all",
    });
    expect(states.length).toBeGreaterThan(0);
    await window.music.control({ action: "forward", seconds: 5 });
    expect(document.querySelector("#audio").currentTime).toBe(5);
    await window.music.control({ action: "backward", seconds: 5 });
    expect(document.querySelector("#audio").currentTime).toBe(0);
  });

  it("plays an M3U in order and accepts shuffle/repeat options", async () => {
    await connect();
    await window.music.playM3U("New.m3u", { shuffle: false, repeat: "all" });
    await waitFor(
      () => window.music.getState().current === "Tamil/Chandramukhi.mp3",
    );
    expect(window.music.getState().repeat).toBe("all");
    expect(window.music.getQueue().map(({ name }) => name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
    ]);
    expect(window.music.getTrack(window.music.getState().current).name).toBe(
      "Chandramukhi.mp3",
    );
    await window.music.control({ action: "next" });
    expect(window.music.getTrack(window.music.getState().current).name).toBe(
      "Second.ogg",
    );
  });

  it("logs only actual starts, appending without truncation or duplicate resume entries", async () => {
    await connect();
    await window.music.control({
      action: "play-track",
      id: "Tamil/Chandramukhi.mp3",
    });
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 1);
    const first = history.text;
    expect(first.split("\n").filter(Boolean)).toHaveLength(1);
    await window.music.control({ action: "pause" });
    await window.music.control({ action: "play" });
    await flush();
    expect(history.text).toBe(first);
    await window.music.control({
      action: "queue-track",
      id: "Tamil/Second.ogg",
    });
    await window.music.control({ action: "next" });
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 2);
    expect(history.text.split("\n").filter(Boolean)).toHaveLength(2);
    expect(history.text).toMatch(/\t[^\t\n]+\tmusic-tool\n/g);
  });

  it("replays repeat-one as a new start and repeat-all cycles in playlist order", async () => {
    await connect();
    await window.music.playM3U("New.m3u", { repeat: "one" });
    const audio = document.querySelector("#audio");
    audio.dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 1);
    await window.music.control({ action: "next", ended: true });
    audio.dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 2);
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");

    await window.music.playM3U("New.m3u", { repeat: "all" });
    await window.music.control({ action: "next" });
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    await window.music.control({ action: "next" });
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
  });

  it("keeps future queue on play-now and uses playback history for previous", async () => {
    await connect();
    await window.music.control({
      action: "queue-track",
      id: "Tamil/Second.ogg",
    });
    await window.music.control({
      action: "play-track",
      id: "Tamil/Chandramukhi.mp3",
    });
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    expect(window.music.getQueue().map(({ id }) => id)).toEqual([
      "Tamil/Chandramukhi.mp3",
      "Tamil/Second.ogg",
    ]);
    await window.music.control({ action: "next" });
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    await window.music.control({ action: "previous" });
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
  });

  it("refreshes externally changed catalog metadata and playlist contents", async () => {
    await connect();
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    const catalog = root.getFileHandle
      ? await root.getFileHandle("musicdump.csv")
      : null;
    const writer = await catalog.createWritable();
    await writer.write(
      "filename,TIT2,TPE1,TALB,TDRC\nChandramukhi.mp3,Refreshed,A R Rahman,Soundtrack,1996\n",
    );
    await writer.close();
    await window.music.control({ action: "refresh" });
    expect(window.music.getTrack("Tamil/Chandramukhi.mp3").title).toBe(
      "Refreshed",
    );
    expect(mediaSession.metadata.title).toBe("Refreshed");
    expect(document.querySelector("#playlist").textContent).toContain(
      "New.m3u",
    );
  });

  it("accepts launchQueue file handles and exposes the documented automation API", async () => {
    await connect();
    expect(typeof window.testLaunchConsumer).toBe("function");
    expect(typeof window.music.control).toBe("function");
    const external = fileHandle("Outside.mp3", "audio");
    await window.testLaunchConsumer({ files: [external] });
    expect(window.music.getTrack(window.music.getState().current).name).toBe(
      "Outside.mp3",
    );
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.includes("Outside.mp3"));
    await window.music.control({ action: "repeat", value: "one" });
    await window.testLaunchConsumer({
      files: [await root.getFileHandle("New.m3u")],
    });
    expect(window.music.getState().repeat).toBe("off");
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
    ]);
  });

  it("serializes rapid actual starts and preserves pre-existing UTF-8 history bytes", async () => {
    const writer = await history.createWritable();
    const original = "2026-09-12T23:15:21+08:00\tதமிழ்.mp3\tanother-tool";
    await writer.write(original);
    await writer.close();
    await connect();
    const audio = document.querySelector("#audio");
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(history.text).toBe(original); // loading and queued play promises are not starts
    audio.dispatchEvent(new window.Event("playing"));
    await window.music.control({
      action: "play-track",
      track: "Tamil/Second.ogg",
    });
    audio.dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 3);
    expect(history.text.startsWith(original + "\n")).toBe(true);
    expect(
      history.text
        .split("\n")
        .filter(Boolean)
        .slice(1)
        .map((line) => line.split("\t")[1]),
    ).toEqual(["Chandramukhi.mp3", "Second.ogg"]);
    audio.dispatchEvent(new window.Event("playing"));
    await flush();
    expect(history.text.split("\n").filter(Boolean)).toHaveLength(3);
    expect(window.music.getHistory({ limit: 0 })).toEqual([]);
  });

  it("shows revoked access and write failures while keeping playback controls usable", async () => {
    await connect();
    history.createWritable = async () => {
      throw new DOMException("Write denied", "NotAllowedError");
    };
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await waitFor(() =>
      document
        .querySelector("#alerts")
        .textContent.includes("History not saved"),
    );
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
    root.queryPermission = async () => "denied";
    const result = await window.music.control({ action: "refresh" });
    expect(result.error).toContain("expired");
    expect(document.querySelector("#alerts").textContent).toContain(
      "Reconnect",
    );
    expect(document.querySelectorAll("#library-body tr")).toHaveLength(2);
  });

  it("reads quoted multiline CSV, degrades malformed catalogs, and refreshes playlists", async () => {
    await connect();
    const catalog = await root.getFileHandle("musicdump.csv");
    let writer = await catalog.createWritable();
    await writer.write(
      'filename,TIT2,TEXT\nChandramukhi.mp3,"A, title","line one\nline two"\n',
    );
    await writer.close();
    await window.music.control({ action: "refresh" });
    expect(window.music.getTrack("Tamil/Chandramukhi.mp3")).toMatchObject({
      title: "A, title",
      description: "line one\nline two",
    });
    writer = await catalog.createWritable();
    await writer.write("broken,catalog\nwithout,filename\n");
    await writer.close();
    await window.music.control({ action: "refresh" });
    expect(window.music.getTrack("Tamil/Chandramukhi.mp3").title).toBe(
      "Chandramukhi.mp3",
    );
    expect(document.querySelector("#alerts").textContent).toContain(
      "Using filenames",
    );
    const playlist = await root.getFileHandle("New.m3u");
    writer = await playlist.createWritable();
    await writer.write("Tamil/Second.ogg\n");
    await writer.close();
    await window.music.control({ action: "refresh" });
    await window.music.playM3U("New.m3u");
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    expect(window.music.getQueue()).toHaveLength(1);
  });

  it("supports shuffled playlists, next insertion, removal, clear, and missing-file skips", async () => {
    await connect();
    window.Math.random = () => 0;
    await window.music.playM3U("New.m3u", { shuffle: true, repeat: "all" });
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    await window.music.control({
      action: "play-next",
      track: "Tamil/Second.ogg",
    });
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Second.ogg",
      "Second.ogg",
      "Chandramukhi.mp3",
    ]);
    await window.music.control({ action: "remove-queue", index: 1 });
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Second.ogg",
      "Chandramukhi.mp3",
    ]);
    await window.music.control({ action: "clear-queue" });
    expect(window.music.getQueue()).toEqual([]);
    await window.music.control({ action: "repeat", value: "off" });
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Second.ogg",
    });
    songs[0].getFile = async () => {
      throw new DOMException("Deleted", "NotFoundError");
    };
    await window.music.control({ action: "next" });
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    expect(document.querySelector("#alerts").textContent).toContain(
      "Skipped 1",
    );
  });

  it("supports slash, escape, shift Enter, double click, column sort and safe Info", async () => {
    await connect();
    const library = document.querySelector("#library-scroll");
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "/", bubbles: true }),
    );
    expect(document.activeElement.id).toBe("search");
    await window.music.control({ action: "filter", query: "rahman" });
    document
      .querySelector("#search")
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    await waitFor(() => window.music.getState().filter === "");
    library.focus();
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await waitFor(() => window.music.getState().selected);
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    await waitFor(() => window.music.getQueue().length === 1);
    document
      .querySelector('#library-body td[data-column="title"]')
      .dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    await waitFor(
      () => window.music.getState().current === "Tamil/Chandramukhi.mp3",
    );
    expect(window.music.getQueue()).toHaveLength(2);
    document.querySelector('#library-head [data-value="title"]').click();
    await waitFor(() => document.querySelector('[aria-sort="ascending"]'));
    document.querySelector('#library-head [data-value="title"]').click();
    await waitFor(() => document.querySelector('[aria-sort="descending"]'));
    await window.music.control({
      action: "show-info",
      track: "Tamil/Chandramukhi.mp3",
    });
    expect(document.querySelector("#info").open).toBe(true);
    expect(document.querySelector("#info-content").textContent).toContain(
      "bytes",
    );
    expect(document.querySelector("#info-content").textContent).toContain(
      "TIT2",
    );
  });

  it("receives inaccessible OS playlists with a clear folder message", async () => {
    await window.testLaunchConsumer({
      files: [fileHandle("outside.m3u", "missing.mp3\n")],
    });
    expect(document.querySelector("#alerts").textContent).toContain(
      "Music folder",
    );
    expect(window.music.getState().current).toBeNull();
  });

  it("plays a directly launched MP3 even when the library permission is revoked", async () => {
    await connect();
    root.resolve = async () => {
      throw new DOMException("Expired", "NotAllowedError");
    };
    await window.testLaunchConsumer({
      files: [fileHandle("Granted.mp3", "audio")],
    });
    expect(window.music.getTrack(window.music.getState().current).name).toBe(
      "Granted.mp3",
    );
  });

  it("logs native Play's next song after completion and unmutes when raising volume", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.control({
      action: "play-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    audio.dispatchEvent(new window.Event("playing"));
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 1);
    audio.dispatchEvent(new window.Event("ended"));
    await window.music.control({ action: "pause" });
    expect(window.music.getQueue()).toHaveLength(1);
    await audio.play();
    await waitFor(() => history.text.split("\n").filter(Boolean).length === 2);
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    audio.muted = true;
    await window.music.control({ action: "volume", value: 0.5 });
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBeCloseTo(0.5 ** 1.2);
  });

  it("keeps title nodes across selection so native double-clicks can play now", async () => {
    await connect();
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Second.ogg",
    });
    const title = document.querySelector(
      '#library-body td[data-column="title"]',
    );
    title.click();
    await waitFor(() => window.music.getState().selected);
    expect(
      document.querySelector('#library-body td[data-column="title"]'),
    ).toBe(title);
    expect(document.activeElement.id).toBe("library-scroll");
    title.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    await waitFor(
      () => window.music.getState().current === "Tamil/Chandramukhi.mp3",
    );
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
    ]);
    const library = document.querySelector("#library-scroll");
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    await waitFor(() => window.music.getQueue().length === 3);
  });

  it("filters a right-clicked library value and navigates/dismisses the menu by keyboard", async () => {
    await connect();
    const artist = document.querySelector(
      '#library-body td[data-column="artist"]',
    );
    artist.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 140,
      }),
    );
    const menu = document.querySelector("#context-menu");
    expect(menu.hidden).toBe(false);
    const filter = [...menu.querySelectorAll("button")].find((button) =>
      button.textContent.startsWith("Filter Artist:"),
    );
    expect(filter.textContent).toBe("Filter Artist: A R Rahman");
    expect(document.activeElement.textContent).toContain("Filter Artist:");
    filter.click();
    await waitFor(() => window.music.getState().filter === "A R Rahman");
    expect(document.querySelectorAll("#library-body tr")).toHaveLength(1);
    const row = document.querySelector("#library-body tr");
    row.click();
    await waitFor(() => window.music.getState().selected);
    document.querySelector("#library-scroll").dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "F10",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(menu.hidden).toBe(false);
    menu.querySelector("button").dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(menu.hidden).toBe(true);
    expect(window.music.getState().filter).toBe("A R Rahman");
    expect(document.activeElement.id).toBe("library-scroll");
  });

  it("moves queue occurrences with context actions, respecting boundaries and retaining Play now", async () => {
    await connect();
    for (const track of [
      "Tamil/Chandramukhi.mp3",
      "Tamil/Second.ogg",
      "Tamil/Chandramukhi.mp3",
    ])
      await window.music.control({ action: "queue-track", track });
    const open = (index) =>
      document.querySelectorAll("#queue-list .queue-row")[index].dispatchEvent(
        new window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 320,
          clientY: 150,
        }),
      );
    const item = (text) =>
      [...document.querySelectorAll("#context-menu button")].find(
        (button) => button.textContent === text,
      );
    open(0);
    expect(item("Move up").disabled).toBe(true);
    expect(item("Move to top").disabled).toBe(true);
    const first = document.activeElement;
    first.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement.textContent).toBe("Locate in playlist");
    item("Move to bottom").click();
    await waitFor(() => window.music.getQueue()[0].name === "Second.ogg");
    open(2);
    expect(item("Move down").disabled).toBe(true);
    item("Move to top").click();
    await waitFor(() => window.music.getQueue()[1].name === "Second.ogg");
    open(1);
    item("Move up").click();
    await waitFor(() => window.music.getQueue()[0].name === "Second.ogg");
    open(0);
    item("Move down").click();
    await waitFor(() => window.music.getQueue()[1].name === "Second.ogg");
    open(1);
    item("Play now").click();
    await waitFor(
      () =>
        window.music.getState().current === "Tamil/Second.ogg" &&
        window.music.getState().queueIndex === 1,
    );
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
      "Chandramukhi.mp3",
    ]);
    open(1);
    item("Remove from queue").click();
    await waitFor(() => window.music.getQueue().length === 2);
    expect(window.music.getState().current).toBeNull();
  });

  it("reorders the queue by dragging rows and rejects stale duplicate-song gestures", async () => {
    await connect();
    for (const track of [
      "Tamil/Chandramukhi.mp3",
      "Tamil/Second.ogg",
      "Tamil/Chandramukhi.mp3",
    ])
      await window.music.control({ action: "queue-track", track });
    const drag = (row, type, y = 0) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientY: { value: y },
        dataTransfer: {
          value: { setData: vi.fn(), effectAllowed: "", dropEffect: "" },
        },
      });
      row.getBoundingClientRect = () => ({ top: 0, height: 20 });
      row.dispatchEvent(event);
      return event;
    };
    let rows = [...document.querySelectorAll("#queue-list .queue-row")];
    expect(rows.every((row) => row.draggable)).toBe(true);
    drag(rows[2], "dragstart");
    expect(drag(rows[0], "dragover").defaultPrevented).toBe(true);
    expect(rows[0].classList.contains("drop-before")).toBe(true);
    drag(rows[0], "drop");
    await waitFor(() => window.music.getQueue()[2].name === "Second.ogg");
    expect(
      document.querySelector(".dragging,.drop-before,.drop-after"),
    ).toBeNull();
    rows = [...document.querySelectorAll("#queue-list .queue-row")];
    drag(rows[2], "dragstart");
    drag(rows[0], "dragover", 19);
    drag(rows[0], "drop", 19);
    await waitFor(() => window.music.getQueue()[1].name === "Second.ogg");
    rows = [...document.querySelectorAll("#queue-list .queue-row")];
    drag(rows[1], "dragstart");
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Second.ogg",
    });
    drag(document.querySelector("#queue-list .queue-row"), "drop");
    await flush();
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
      "Chandramukhi.mp3",
      "Second.ogg",
    ]);
  });

  it("documents shortcuts in Help and tooltips and routes player shortcuts through controls", async () => {
    await connect();
    expect(document.querySelector("#keyboard-shortcuts").textContent).toContain(
      "Ctrl+Enter",
    );
    expect(document.querySelector("#keyboard-shortcuts").textContent).toContain(
      "Shift+F10",
    );
    expect(document.querySelector("#global-shortcuts").textContent).toContain(
      "Ctrl+Super+Space — Global play/pause",
    );
    expect(
      [...document.querySelectorAll("#help h3")].slice(0, 3).map((heading) => heading.textContent),
    ).toEqual(["Global shortcuts", "Keyboard shortcuts", "Library & playback"]);
    expect(
      [...document.querySelectorAll("#global-shortcuts kbd")].map((key) => key.textContent),
    ).toEqual([
      "Ctrl+Super+Space", "Ctrl+Super+PageUp", "Ctrl+Super+PageDown",
      "Ctrl+Super+Left", "Ctrl+Super+Right", "Ctrl+Super+M",
    ]);
    expect(document.querySelector("#keyboard-shortcuts").textContent).not.toContain("Ctrl+Super");
    expect(document.querySelector("#help").textContent).toContain(
      "~/code/scripts/setup/media-keys.dconf",
    );
    expect(
      document.querySelector('[data-action="queue-track"]').title,
    ).toContain("Ctrl+Enter");
    expect(
      document.querySelector('[data-action="play-track"]').title,
    ).toContain("Enter");
    const library = document.querySelector("#library-scroll");
    library.focus();
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => document.querySelector("#audio").currentTime === 5);
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "r",
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => window.music.getState().repeat === "all");
    const search = document.querySelector("#search");
    search.focus();
    search.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "r", bubbles: true }),
    );
    await flush();
    expect(window.music.getState().repeat).toBe("all");
  });

  it("keeps context-menu keys isolated and opens the queue menu from its list focus", async () => {
    await connect();
    await window.music.control({
      action: "select",
      id: "Tamil/Chandramukhi.mp3",
    });
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Second.ogg",
    });
    const queue = document.querySelector("#queue-list");
    queue.focus();
    queue.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "F10",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    const menu = document.querySelector("#context-menu");
    expect(menu.getAttribute("aria-label")).toBe("Queue actions");
    menu.querySelector("button").dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "r",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();
    expect(window.music.getState().repeat).toBe("off");
    menu.querySelector("button").dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    const empty = document.querySelectorAll(
      '#library-body td[data-column="artist"]',
    )[1];
    empty.dispatchEvent(
      new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(
      [...menu.querySelectorAll("button")].find((button) =>
        button.textContent.startsWith("Filter Artist:"),
      ).disabled,
    ).toBe(false);
    menu.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();
    expect(window.music.getState().current).toBeNull();
  });

  it("inserts whole-row double-clicks after the current occurrence and retains played rows", async () => {
    await connect();
    await window.music.playM3U("New.m3u");
    const audio = document.querySelector("#audio");
    audio.dispatchEvent(new window.Event("playing"));
    document
      .querySelectorAll('#library-body td[data-column="artist"]')[1]
      .dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    await waitFor(() => window.music.getState().queueIndex === 1);
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Second.ogg",
      "Second.ogg",
    ]);
    expect(window.music.getQueue()[0].status).toBe("played");
    expect(
      document.querySelectorAll('#queue-list [aria-current="true"]'),
    ).toHaveLength(1);
    await window.music.control({
      action: "move-queue",
      index: 1,
      to: "bottom",
    });
    expect(window.music.getState().queueIndex).toBe(2);
    expect(window.music.getQueue()[2].current).toBe(true);
  });

  it("appends ten Play Any songs, jumps to that batch, and uses only the selected playlist", async () => {
    await connect();
    await window.music.playM3U("New.m3u");
    await window.music.control({ action: "playlist", value: "New.m3u" });
    await window.music.control({ action: "filter", query: "rahman" });
    const button = document.querySelector('[data-action="play-any"]');
    expect(button.textContent).toContain("Play Any");
    button.click();
    await waitFor(() => window.music.getQueue().length === 12);
    expect(window.music.getState().queueIndex).toBe(2);
    expect(
      window.music
        .getQueue()
        .slice(2)
        .every((t) => t.name === "Chandramukhi.mp3"),
    ).toBe(true);
    expect(window.music.getQueue()[1].status).toBe("next");
  });

  it("serializes queue.tsv changes, restores paused, and rereads external edits", async () => {
    await connect();
    await window.music.playM3U("New.m3u");
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await window.music.control({ action: "next" });
    await Promise.all([
      window.music.control({
        action: "queue-track",
        track: "Tamil/Chandramukhi.mp3",
      }),
      window.music.control({ action: "move-queue", index: 2, to: "top" }),
    ]);
    const saved = await root.getFileHandle("queue.tsv");
    expect(saved.text).toBe(
      "path\tstatus\nTamil/Chandramukhi.mp3\tnext\nTamil/Chandramukhi.mp3\tplayed\nTamil/Second.ogg\tcurrent\n",
    );
    await page.close();
    ({ window, document } = await loadPlayer());
    window.showDirectoryPicker = async () => root;
    await connect();
    expect(window.music.getState()).toMatchObject({
      current: "Tamil/Second.ogg",
      queueIndex: 2,
      playing: false,
    });
    expect(window.music.getQueue().map((t) => t.status)).toEqual([
      "next",
      "played",
      "current",
    ]);
    expect(document.querySelector("#audio").getAttribute("src")).toBeNull();
    expect(window.navigator.mediaSession.metadata.title).toBe("Second Song");
    expect(window.navigator.mediaSession.playbackState).toBe("paused");
    expect(window.navigator.mediaSession.setPositionState).toHaveBeenLastCalledWith();
    const writer = await saved.createWritable();
    await writer.write(
      "path\tstatus\nTamil/Second.ogg\tnext\nmissing.mp3\tnext\n",
    );
    await writer.close();
    await window.music.control({ action: "refresh" });
    expect(window.music.getQueue().map((t) => t.name)).toEqual(["Second.ogg"]);
    expect(document.querySelector("#alerts").textContent).toContain(
      "queue.tsv",
    );
    expect(history.text.split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("provides library actions and queue range removals via the context menus", async () => {
    await connect();
    const open = (el) =>
      el.dispatchEvent(
        new window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
    const item = (label) =>
      [...document.querySelectorAll("#context-menu button")].find(
        (b) => b.textContent === label,
      );
    open(document.querySelector('#library-body td[data-column="artist"]'));
    for (const label of ["Play now", "Play next", "Info"])
      expect(
        item(label) ||
          [...document.querySelectorAll("#context-menu button")].find(
            (button) => button.textContent.includes(label),
          ),
      ).toBeTruthy();
    const queueAction =
      item("Play at end") ||
      [...document.querySelectorAll("#context-menu button")].find((button) =>
        /queue|play at end/i.test(button.textContent),
      );
    if (!queueAction)
      throw new Error(
        `Library context actions: ${[...document.querySelectorAll("#context-menu button")].map((button) => button.textContent).join(" | ")}`,
      );
    queueAction.click();
    await waitFor(() => window.music.getQueue().length === 1);
    await window.music.playM3U("New.m3u");
    await window.music.control({
      action: "queue-track",
      track: "Tamil/Chandramukhi.mp3",
    });
    open(document.querySelectorAll("#queue-list .queue-row")[1]);
    item("Remove all below").click();
    await waitFor(() => window.music.getQueue().length === 2);
    open(document.querySelectorAll("#queue-list .queue-row")[1]);
    item("Remove all above").click();
    await waitFor(() => window.music.getQueue().length === 1);
    expect(window.music.getState().current).toBeNull();
    expect(window.music.getQueue()[0].name).toBe("Second.ogg");
  });

  it("uses gentle upper-range volume, reversible mute, native synchronization and keyboard shortcuts", async () => {
    await connect();
    const audio = document.querySelector("#audio");
    await window.music.control({ action: "volume", value: 0.9 });
    expect(audio.volume).toBeGreaterThan(0.85);
    await window.music.control({ action: "volume", value: 0.5 });
    expect(audio.volume).toBeCloseTo(0.5 ** 1.2);
    document.querySelector("#mute").click();
    await waitFor(() => window.music.getState().muted);
    expect(window.music.getState().volume).toBe(0.5);
    document.querySelector("#mute").click();
    await waitFor(() => !window.music.getState().muted);
    expect(audio.volume).toBeCloseTo(0.5 ** 1.2);
    const library = document.querySelector("#library-scroll");
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "+", bubbles: true }),
    );
    await waitFor(() => window.music.getState().volume === 0.55);
    library.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "-", bubbles: true }),
    );
    await waitFor(() => window.music.getState().volume === 0.5);
    audio.volume = 0.9;
    audio.muted = true;
    audio.dispatchEvent(new window.Event("volumechange"));
    expect(window.music.getState()).toMatchObject({
      volume: 0.9 ** (1 / 1.2),
      muted: true,
    });
    const prefs = JSON.parse(window.localStorage.getItem("music-preferences"));
    expect(prefs).toMatchObject({ volume: 0.9 ** (1 / 1.2), muted: true });
    document
      .querySelector("#search")
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "-", bubbles: true }),
      );
    await flush();
    expect(window.music.getState().volume).toBeCloseTo(0.9 ** (1 / 1.2));
    expect(document.querySelector("#keyboard-shortcuts").textContent).toContain(
      "Increase volume",
    );
  });

  it("preserves malformed queue files until an explicit mutation and reports failed writes", async () => {
    const saved = await root.getFileHandle("queue.tsv", { create: true });
    const writer = await saved.createWritable();
    await writer.write("keep this malformed input");
    await writer.close();
    await connect();
    expect(saved.text).toBe("keep this malformed input");
    expect(document.querySelector("#alerts").textContent).toContain(
      "invalid path/status",
    );
    saved.createWritable = async () => {
      throw new DOMException("Queue write denied", "NotAllowedError");
    };
    await window.music.control({
      action: "play-track",
      track: "Tamil/Second.ogg",
    });
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
    expect(saved.text).toBe("keep this malformed input");
    expect(document.querySelector("#alerts").textContent).toContain(
      "Queue not saved",
    );
  });

  it("restores duplicate paths and safely quotes tabs and Unicode in queue.tsv", async () => {
    const unusual = fileHandle("தமிழ்\tSong.mp3", "audio");
    const unusualRoot = directoryHandle("Music", [unusual]);
    window.showDirectoryPicker = async () => unusualRoot;
    await window.music.control({ action: "change-folder" });
    await window.music.control({ action: "queue-track", track: unusual.name });
    await window.music.control({ action: "queue-track", track: unusual.name });
    const saved = await unusualRoot.getFileHandle("queue.tsv");
    expect(saved.text).toContain('"தமிழ்\tSong.mp3"');
    await window.music.control({ action: "refresh" });
    expect(window.music.getQueue().map((t) => t.path)).toEqual([
      unusual.name,
      unusual.name,
    ]);
    await window.music.control({ action: "play-queue", index: 1 });
    expect(window.music.getState().queueIndex).toBe(1);
    await window.music.control({ action: "refresh" });
    expect(window.music.getState().queueIndex).toBe(1);
  });

  it("keeps directly launched outside songs in this session when refreshing a saved queue", async () => {
    await connect();
    await window.music.playM3U("New.m3u");
    await window.testLaunchConsumer({
      files: [fileHandle("Outside.mp3", "audio")],
    });
    const saved = await root.getFileHandle("queue.tsv");
    expect(saved.text).not.toContain("Outside.mp3");
    expect(document.querySelector("#alerts").textContent).toContain(
      "session only",
    );
    await window.music.control({ action: "refresh" });
    expect(window.music.getQueue().map((t) => t.name)).toEqual([
      "Chandramukhi.mp3",
      "Outside.mp3",
      "Second.ogg",
    ]);
    expect(window.music.getState().queueIndex).toBe(1);
    expect(window.music.getTrack(window.music.getState().current).name).toBe(
      "Outside.mp3",
    );
  });

  it("preserves current and played entries when shuffling the future, and saves an empty queue after clear", async () => {
    await connect();
    await window.music.playM3U("New.m3u");
    document.querySelector("#audio").dispatchEvent(new window.Event("playing"));
    await window.music.control({ action: "play-any" });
    const prefix = window.music.getQueue().slice(0, 3);
    await window.music.control({ action: "shuffle-queue" });
    expect(window.music.getQueue().slice(0, 3)).toEqual(prefix);
    expect(window.music.getState().queueIndex).toBe(2);
    await window.music.control({ action: "clear-queue" });
    expect(window.music.getQueue()).toEqual([]);
    expect(window.music.getState().current).toBeNull();
    expect((await root.getFileHandle("queue.tsv")).text).toBe("path\tstatus\n");
    expect(document.querySelector("#now-title").textContent).toBe(
      "Choose something good",
    );
  });

  it("closes the menu with Escape and returns Space to playback", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.control({ action: "play-track", track: "Tamil/Chandramukhi.mp3" });
    await waitFor(() => !audio.paused);
    document.querySelector("#menu summary").click();
    expect(document.querySelector("#menu").open).toBe(true);
    document.querySelector("#menu summary").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector("#menu").open).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#library-scroll"));
    document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    await waitFor(() => audio.paused);
  });

  it("clears a search with Escape without changing a playing queue", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.control({ action: "play-m3u", path: "New.m3u" });
    await waitFor(() => !audio.paused);
    const before = window.music.getQueue().map(({ name }) => name);
    const search = document.querySelector("#search");
    search.focus();
    search.value = "rahman";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    await waitFor(() => window.music.getState().filter === "rahman");
    search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => window.music.getState().filter === "");
    expect(window.music.getQueue().map(({ name }) => name)).toEqual(before);
    expect(window.music.getState().current).toBe("Tamil/Chandramukhi.mp3");
  });

  it("treats a cancelled folder picker as a harmless user action", async () => {
    window.showDirectoryPicker.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    document.querySelector("#connect").click();
    await flush();
    expect(window.music.getState().current).toBeNull();
    expect(document.querySelector("#alerts").textContent).not.toContain("Cancelled");
  });

  it("reports revoked folder permission and lets the user retry reconnect", async () => {
    await connect();
    root.requestPermission = vi.fn(async () => "denied");
    document.querySelector("#connect").click();
    await waitFor(() => document.querySelector("#alerts").textContent.includes("permission"));
    expect(window.music.getState().folder).toBe("Music");
    root.requestPermission.mockResolvedValue("granted");
    document.querySelector("#connect").click();
    await waitFor(() => document.querySelector("#count").textContent === "2 tracks");
  });

  it("recovers from a decode error by moving to the next queued song", async () => {
    await connect();
    const audio = nativeAudio();
    await window.music.control({ action: "queue-track", track: "Tamil/Chandramukhi.mp3" });
    await window.music.control({ action: "queue-track", track: "Tamil/Second.ogg" });
    await window.music.control({ action: "play-queue", index: 0 });
    audio.dispatchEvent(new window.Event("error"));
    expect(document.querySelector("#alerts").textContent).toContain("Cannot decode");
    await window.music.control({ action: "next" });
    expect(window.music.getState().current).toBe("Tamil/Second.ogg");
  });

  it("builds a queue from keyboard intent before playing the selected result", async () => {
    await connect();
    const library = document.querySelector("#library-scroll");
    library.focus();
    library.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await waitFor(() => window.music.getState().selected === "Tamil/Chandramukhi.mp3");
    library.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    await waitFor(() => window.music.getQueue().length === 1);
    library.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    await waitFor(() => window.music.getQueue().length === 2);
    library.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitFor(() => window.music.getState().current === "Tamil/Chandramukhi.mp3");
    expect(window.music.getQueue().map(({ name }) => name)).toEqual([
      "Chandramukhi.mp3",
      "Chandramukhi.mp3",
      "Chandramukhi.mp3",
    ]);
  });

  it("reveals more search results, sorts them, and keeps selection on a real row", async () => {
    const tamil = await root.getDirectoryHandle("Tamil");
    for (let index = 0; index < 205; index += 1) tamil.children.push(fileHandle(`Extra-${index}.mp3`, "audio"));
    document.querySelector("#connect").click();
    await waitFor(() => document.querySelector("#count").textContent === "207 tracks");
    expect(document.querySelectorAll("#library-body tr[data-id]")).toHaveLength(200);
    document.querySelector("#more").click();
    await waitFor(() => document.querySelectorAll("#library-body tr[data-id]").length === 207);
    document.querySelector('#library-head [data-value="title"]').click();
    await waitFor(() => document.querySelector('[aria-sort="ascending"]'));
    const row = document.querySelector('#library-body tr[data-id="Tamil/Extra-204.mp3"]');
    row.click();
    await waitFor(() => window.music.getState().selected === "Tamil/Extra-204.mp3");
    expect(row.getAttribute("aria-selected")).toBe("true");
  });

  it("closes the track info dialog with Escape and restores the library focus", async () => {
    await connect();
    await window.music.control({ action: "show-info", track: "Tamil/Chandramukhi.mp3" });
    const dialog = document.querySelector("#info");
    expect(dialog.open).toBe(true);
    dialog.querySelector("button").focus();
    dialog.querySelector("button").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await flush();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#library-scroll"));
  });

  it("declares the required Chromium file handlers in the manifest", async () => {
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(import.meta.dirname, "manifest.webmanifest"),
        "utf8",
      ),
    );
    expect(manifest.file_handlers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "/music/",
          accept: expect.objectContaining({ "audio/mpeg": [".mp3"] }),
        }),
        expect.objectContaining({
          accept: expect.objectContaining({
            "audio/x-mpegurl": [".m3u"],
            "application/vnd.apple.mpegurl": [".m3u", ".m3u8"],
          }),
        }),
      ]),
    );
  });

});
