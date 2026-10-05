// @ts-check
import { csvParse } from "../common/csv.js";

const LIBRARY_COLUMNS = [
  { key: "title", label: "Title", field: "TIT2" },
  { key: "artist", label: "Artist", field: "TPE1" },
  { key: "album", label: "Album", field: "TALB" },
  { key: "composer", label: "Composer", field: "TCOM" },
  { key: "genre", label: "Genre", field: "TCON" },
  { key: "year", label: "Year", field: "TDRC" },
  { key: "duration", label: "Duration", field: "length" },
  { key: "track", label: "Track", field: "TRCK" },
  { key: "description", label: "Description", field: "TEXT" },
  { key: "path", label: "File / path" },
];
const AUDIO_PATTERN =
  /\.(mp3|m4a|mp4|opus|ogg|oga|flac|wav|aac|aiff|aif|webm|weba|wma|amr)$/i;
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
const basename = (path) => path.split("/").at(-1);
const cleanPath = (value) => {
  let path = String(value).trim().replace(/\\/g, "/");
  if (/^file:/i.test(path)) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      /* Keep malformed entries unresolved. */
    }
  }
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
};
function fileIndex(tracks) {
  const paths = new Map(tracks.map((track) => [cleanPath(track.path), track]));
  const folded = new Map();
  const names = new Map();
  for (const track of tracks) {
    const path = cleanPath(track.path).toLowerCase();
    folded.set(path, folded.has(path) ? null : track);
    const name = basename(track.path).toLowerCase();
    names.set(name, names.has(name) ? null : track);
  }
  return { paths, folded, names };
}
function resolvePath(value, parent, index, rootName = "") {
  const path = cleanPath(value);
  const lower = path.toLowerCase();
  const relative = !/^(\/|[a-z]:|file:)/i.test(value.trim());
  if (relative && parent) {
    const relativePath = cleanPath(`${parent}/${value}`);
    const match =
      index.paths.get(relativePath) ||
      index.folded.get(relativePath.toLowerCase());
    if (match) return match;
  }
  if (index.paths.has(path)) return index.paths.get(path);
  if (index.folded.get(lower)) return index.folded.get(lower);
  const root = rootName ? lower.lastIndexOf(`${rootName.toLowerCase()}/`) : -1;
  if (root >= 0) {
    const suffix = path.slice(root + rootName.length + 1);
    const match =
      index.paths.get(suffix) || index.folded.get(suffix.toLowerCase());
    if (match) return match;
  }
  return index.names.get(basename(lower));
}
export function joinCatalog(files, csv = "", rootName = "") {
  const index = fileIndex(files);
  const metadata = new Map();
  // Existing filename paths are authoritative. Never attach an ambiguous basename.
  const catalog = csvParse(csv.replace(/^\uFEFF/, ""));
  if (csv.trim() && !catalog.columns.includes("filename"))
    throw new Error("Missing filename column");
  for (const row of catalog) {
    if (!row.filename) continue;
    const track = resolvePath(row.filename, "", index, rootName);
    if (track && !metadata.has(track.id)) metadata.set(track.id, row);
  }
  return files.map((file) => {
    const meta = metadata.get(file.id) ?? {};
    const track = { ...file, metadata: meta };
    for (const column of LIBRARY_COLUMNS)
      if (column.field) track[column.key] = meta[column.field] || "";
    track.title ||= file.name || basename(file.path);
    const values = [file.path, ...Object.values(meta)];
    const aliases = Object.values(meta).flatMap((value) =>
      String(value)
        .split(/[,;&/]+/)
        .map((name) =>
          normalize(name)
            .split(" ")
            .map((word) => word[0])
            .join(""),
        ),
    );
    track.search = normalize([...values, ...aliases].join(" "));
    track.words = track.search.split(" ");
    return track;
  });
}
// A single edit (including transposition), only for words >= 4 letters. Numeric prefixes stay exact.
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a]
      .map((char, i) => (char !== b[i] ? i : -1))
      .filter((i) => i >= 0);
    return (
      differences.length <= 1 ||
      (differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        a[differences[0]] === b[differences[1]] &&
        a[differences[1]] === b[differences[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}
export function searchTracks(tracks, query) {
  const exact = String(query).trim();
  const normalized = normalize(query);
  const terms = normalized.split(" ").filter(Boolean);
  if (!terms.length) return tracks.slice();
  return tracks
    .map((track) => {
      const values = [
        track.path,
        track.title,
        ...Object.values(track.metadata ?? {}),
      ];
      // Prefer a complete field (e.g. album Ko), preserving case for the best match.
      let score = values.some((value) => String(value).trim() === exact)
        ? 24
        : values.some((value) => normalize(value) === normalized)
          ? 16
          : 0;
      for (const term of terms) {
        if (track.words.includes(term)) score += 12;
        else if (
          track.search.includes(term) ||
          track.search.replaceAll(" ", "").includes(term)
        )
          score += 8;
        else if (
          term.length >= 4 &&
          !/\d/.test(term) &&
          track.words.some((word) => near(term, word))
        )
          score += 1;
        else return { track, score: -1 };
      }
      return { track, score };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track);
}
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const sortTracks = (tracks, key, direction = "asc") =>
  tracks
    .slice()
    .sort(
      (a, b) =>
        (key === "duration"
          ? (Number(a[key]) || 0) - (Number(b[key]) || 0)
          : collator.compare(String(a[key] ?? ""), String(b[key] ?? ""))) *
        (direction === "desc" ? -1 : 1),
    );
export function resolveM3U(text, playlistPath, tracks, rootName = "") {
  const index = fileIndex(tracks);
  const parent = playlistPath.includes("/")
    ? playlistPath.slice(0, playlistPath.lastIndexOf("/"))
    : "";
  const result = { tracks: [], missing: [] };
  for (const entry of text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))) {
    const track = resolvePath(entry, parent, index, rootName);
    if (track) result.tracks.push(track);
    else result.missing.push(entry);
  }
  return result;
}
export function shuffled(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Port of scripts/play-music: metadata scores and repetition penalties only.
// Playlist preferences and MusicBrainz identity are deliberately outside this player.
const SIMILARITY_FIELDS = {
  genre: "TCON",
  composer: "TCOM",
  singer: "TPE1",
  year: "TDRC",
  album: "TALB",
};
const SIMILARITY_WEIGHTS = {
  genre: 2.5,
  composer: 2.5,
  singer: 2.5,
  year: 1.5,
  album: 1,
};
const textKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .trim();
const metadataValue = (track, key) =>
  track?.metadata?.[SIMILARITY_FIELDS[key]] ??
  track?.[SIMILARITY_FIELDS[key]] ??
  track?.[key === "singer" ? "artist" : key] ??
  "";
const people = (value) =>
  new Set(String(value).split(/[,;]/).map(textKey).filter(Boolean));
const dice = (a, b) =>
  a.size && b.size
    ? (2 * [...a].filter((name) => b.has(name)).length) / (a.size + b.size)
    : 0;
const languagePairs = {
  "tamil|telugu": 0.8,
  "malayalam|tamil": 0.7,
  "malayalam|telugu": 0.6,
  "hindi|tamil": 0.3,
  "hindi|telugu": 0.25,
  "hindi|malayalam": 0.2,
};
const indianLanguages = new Set(["tamil", "telugu", "malayalam", "hindi"]);
function genreSimilarity(a, b) {
  a = textKey(a);
  b = textKey(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const known = languagePairs[[a, b].sort().join("|")];
  if (known != null) return known;
  if (indianLanguages.has(a) && indianLanguages.has(b)) return 0.15;
  return (a === "english" && indianLanguages.has(b)) ||
    (b === "english" && indianLanguages.has(a))
    ? 0.08
    : 0;
}
/** Return the weighted metadata score and its five explanatory parts. */
const similarity = (seed, candidate) => {
  const left = Object.fromEntries(
    Object.keys(SIMILARITY_FIELDS).map((key) => [
      key,
      metadataValue(seed, key),
    ]),
  );
  const right = Object.fromEntries(
    Object.keys(SIMILARITY_FIELDS).map((key) => [
      key,
      metadataValue(candidate, key),
    ]),
  );
  const parts = {
    genre: genreSimilarity(left.genre, right.genre),
    composer: dice(people(left.composer), people(right.composer)),
    singer: dice(people(left.singer), people(right.singer)),
    year:
      /^\d+$/.test(left.year) && /^\d+$/.test(right.year)
        ? 0.5 ** (Math.abs(Number(left.year) - Number(right.year)) / 10)
        : 0,
    album:
      textKey(left.album) && textKey(left.album) === textKey(right.album)
        ? 1
        : 0,
  };
  for (const key of Object.keys(parts)) parts[key] *= SIMILARITY_WEIGHTS[key];
  return {
    score: Object.values(parts).reduce((sum, part) => sum + part, 0),
    parts,
  };
};
function duplicateSong(a, b) {
  const pathA = a.id ?? a.path ?? a.filename;
  const pathB = b.id ?? b.path ?? b.filename;
  if (pathA && pathA === pathB) return true;
  const titleA = textKey(a.metadata?.TIT2 ?? a.TIT2 ?? a.title);
  const titleB = textKey(b.metadata?.TIT2 ?? b.TIT2 ?? b.title);
  const composer = textKey(metadataValue(a, "composer"));
  return (
    !!titleA &&
    !!composer &&
    titleA === titleB &&
    composer === textKey(metadataValue(b, "composer"))
  );
}
/** Choose up to ten related tracks from the top thirty, with modest variety. */
export function pickSimilarTracks(
  seed,
  tracks,
  { limit = 10, poolSize = 30, random = Math.random } = {},
) {
  const pool = tracks
    .filter((track) => !duplicateSong(seed, track))
    .map((track) => ({
      track,
      score: similarity(seed, track).score,
      jitter: random() * 0.65,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, poolSize));
  const selected = [],
    albums = new Map(),
    composers = new Map(),
    singers = new Map();
  const count = (map, key) => map.get(key) || 0;
  const adjusted = ({ track, score, jitter }) =>
    score +
    jitter -
    count(albums, textKey(metadataValue(track, "album"))) -
    [...people(metadataValue(track, "composer"))].reduce(
      (sum, name) => sum + count(composers, name) * 0.45,
      0,
    ) -
    [...people(metadataValue(track, "singer"))].reduce(
      (sum, name) => sum + count(singers, name) * 0.35,
      0,
    );
  while (selected.length < Math.max(0, limit)) {
    const available = pool.filter(
      ({ track }) => !selected.some((chosen) => duplicateSong(chosen, track)),
    );
    if (!available.length) break;
    const chosen = available.reduce((best, item) =>
      adjusted(item) > adjusted(best) ? item : best,
    ).track;
    selected.push(chosen);
    const album = textKey(metadataValue(chosen, "album"));
    if (album) albums.set(album, count(albums, album) + 1);
    for (const [key, map] of [
      ["composer", composers],
      ["singer", singers],
    ])
      for (const name of people(metadataValue(chosen, key)))
        map.set(name, count(map, name) + 1);
  }
  return selected;
}
export function localTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

export { LIBRARY_COLUMNS, AUDIO_PATTERN, normalize, sortTracks, similarity };
