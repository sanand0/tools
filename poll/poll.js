// @ts-check
// Poll protocol, state and TSV storage. No DOM access, so it runs in browsers and Node (tests).
//
// Topics: participants publish unsigned messages on `up`. The presenter publishes signed envelopes on
// `all` (everyone) and `c/<id>` (one participant). Participants verify signatures (signing.js), so only
// the browser holding the presenter key can change the question, choices or voting state.

const ROOM = /^[A-Z2-9]{8}$/;
const ID = /^[a-z0-9]{8,32}$/;
const LIMITS = { question: 500, choice: 80, choices: 12, participants: 5000 };
const ONLINE_MS = 25000; // a participant is "connected" if heard from within this window
const PING_MS = 10000;

const topics = (room) => {
  const base = `poll/v1/${room}`;
  return { up: `${base}/up`, all: `${base}/all`, client: (id) => `${base}/c/${id}` };
};

const uid = (prefix = "", length = 12) =>
  prefix + [...crypto.getRandomValues(new Uint8Array(length))].map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

const text = (value, max) => String(value ?? "").slice(0, max);
const choice = (label) => ({ id: uid("c", 8), text: text(label, LIMITS.choice) });

/** Parse a simple Markdown list: questions at column 1, choices indented by two spaces. */
function parseSeedMarkdown(source) {
  const questions = [];
  for (const [i, line] of String(source).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = /^( *)(?:- )(.+?)\s*$/.exec(line);
    if (!match || ![0, 2].includes(match[1].length)) throw new Error(`Line ${i + 1}: use "- Question" or "  - Option".`);
    const value = match[2].trim();
    const isChoice = match[1].length === 2;
    const max = isChoice ? LIMITS.choice : LIMITS.question;
    if (value.length > max) throw new Error(`Line ${i + 1}: text exceeds ${max} characters.`);
    if (isChoice) {
      const last = questions.at(-1);
      if (!last) throw new Error(`Line ${i + 1}: option without a question.`);
      if (last.choices.length >= LIMITS.choices) throw new Error(`Line ${i + 1}: maximum ${LIMITS.choices} options per question.`);
      last.choices.push(value);
    } else questions.push({ text: value, choices: [] });
  }
  for (const [i, q] of questions.entries())
    if (q.choices.length < 2) throw new Error(`Question ${i + 1}: add at least two options.`);
  return questions;
}

/** A fresh question: Yes / No choices, voting open, results hidden. */
const blankQuestion = (question = "") => ({
  id: uid("q", 12),
  text: text(question, LIMITS.question),
  choices: [choice("Yes"), choice("No")],
  /** @type {Record<string, string>} participant id → choice id */ votes: {},
  /** @type {Record<string, number>} participant id → latest vote sequence number */ seq: {},
  open: true,
  revealed: false,
});

/** Monotonic revision: survives reloads because it never falls behind the clock. */
const nextRev = (rev) => Math.max(rev + 1, Date.now());

// ---------- Presenter (authoritative state) ----------

class PollHost {
  /**
   * @param {{send:(to:string, data:any)=>any, onChange?:(kind:string)=>void, now?:()=>number}} options
   * `send(to, data)` delivers to "all" or a participant id; the caller signs and publishes.
   */
  constructor({ send, onChange = () => {}, now = Date.now }) {
    Object.assign(this, { send, onChange, now });
    /** @type {Record<string, {first:number, seen:number}>} */ this.participants = {};
    this.question = blankQuestion();
    /** @type {any[]} past questions with their votes, oldest first. Never sent to participants. */ this.history = [];
    this.rev = 0;
  }

  /** Set up a new room with the first question live and the rest ready in the existing history list. */
  seed(questions) {
    if (!questions.length) return;
    const make = ({ text, choices }) => ({ ...blankQuestion(text), choices: choices.map(choice), prepared: true });
    this.question = make(questions[0]);
    this.history = questions.slice(1).map((item) => ({
      ...make(item), open: false, queued: true, joined: 0, closedAt: this.now(),
    }));
    this.rev = nextRev(this.rev);
  }

  get joined() { return Object.keys(this.participants).length; }
  get connected() {
    const now = this.now();
    return Object.values(this.participants).filter((p) => now - p.seen < ONLINE_MS).length;
  }
  get responses() { return this.responsesOf(this.question); }
  responsesOf(q) { return q.tally ? q.total : Object.values(q.votes).filter((cid) => q.choices.some((c) => c.id === cid)).length; }
  /** @returns {Record<string, number>} choice id → votes */
  counts(q = this.question) {
    if (q.tally) return { ...q.tally }; // imported from a TSV: counts only, no individual votes
    const counts = Object.fromEntries(q.choices.map((c) => [c.id, 0]));
    for (const cid of Object.values(q.votes)) if (cid in counts) counts[cid]++;
    return counts;
  }
  /** The current question or a past one, by id. */
  find(qid) { return this.question.id === qid ? this.question : this.history.find((q) => q.id === qid) ?? null; }

  changed(kind = "state") {
    this.rev = nextRev(this.rev);
    this.onChange(kind);
  }

  /** What every participant sees. No per-choice counts: the breakdown is revealed only on the projector. */
  publicState(extra = {}) {
    const { id, text, choices, open } = this.question;
    return { t: "state", rev: this.rev, q: { id, text, choices, open }, responses: this.responses, joined: this.joined, connected: this.connected, ...extra };
  }
  broadcast(extra = {}) { return this.send("all", this.publicState(extra)); }

  /** One participant's own current response. */
  you(pid, extra = {}) {
    const q = this.question;
    return { t: "you", rev: this.rev, qid: q.id, cid: q.votes[pid] ?? null, n: q.seq[pid] ?? 0, ...extra };
  }

  /** Handles an (unsigned) participant message. */
  handle(msg) {
    if (!msg || typeof msg !== "object" || typeof msg.id !== "string" || !ID.test(msg.id)) return;
    const { id } = msg;
    const isNew = !this.participants[id];
    if (isNew && this.joined >= LIMITS.participants) return;
    const before = this.connected;
    if (msg.t === "bye") {
      if (!isNew) this.participants[id].seen = 0;
    } else {
      this.participants[id] ??= { first: this.now(), seen: 0 };
      this.participants[id].seen = this.now();
    }
    if (msg.t === "hello") {
      this.send(id, this.publicState());
      this.send(id, this.you(id));
    } else if (msg.t === "vote") this.vote(id, msg);
    if (isNew || before !== this.connected) this.changed("people");
  }

  vote(pid, { qid, cid, n }) {
    const q = this.question;
    n = Number(n);
    // Votes for an older question, or sent while voting is paused, are not counted. The reply tells the
    // participant what is current; while paused, they keep the vote pending and resend it when voting reopens.
    if (qid !== q.id || !q.open || !Number.isFinite(n)) return this.send(pid, this.you(pid));
    // Duplicates and delayed older votes from this participant are ignored: their newest vote wins.
    if (n <= (q.seq[pid] ?? 0)) return this.send(pid, this.you(pid));
    q.seq[pid] = n;
    if (!q.choices.some((c) => c.id === cid)) {
      // The choice was removed before this vote arrived: ask them to vote again.
      const had = pid in q.votes;
      delete q.votes[pid];
      if (had) this.changed("votes");
      return this.send(pid, this.you(pid, { revote: true }));
    }
    const prev = q.votes[pid];
    q.votes[pid] = cid; // one current response per participant: replaces their previous choice
    if (prev !== cid) this.changed("votes");
    this.send(pid, this.you(pid));
  }

  // ----- Presenter edits -----
  setText(value) {
    const next = text(value, LIMITS.question);
    if (next === this.question.text) return;
    this.question.text = next;
    this.changed("text");
  }
  addChoice(label = "") {
    if (this.question.choices.length >= LIMITS.choices) return null;
    const c = choice(label);
    this.question.choices.push(c);
    this.changed("choices");
    return c;
  }
  renameChoice(cid, label) {
    const c = this.question.choices.find((c) => c.id === cid);
    if (!c || c.text === text(label, LIMITS.choice)) return;
    c.text = text(label, LIMITS.choice);
    this.changed("choices");
  }
  /** Removes a choice, invalidates only its votes, and asks those participants to vote again. */
  removeChoice(cid) {
    const q = this.question;
    if (q.choices.length <= 1 || !q.choices.some((c) => c.id === cid)) return [];
    q.choices = q.choices.filter((c) => c.id !== cid);
    const affected = Object.keys(q.votes).filter((pid) => q.votes[pid] === cid);
    for (const pid of affected) delete q.votes[pid];
    this.changed("choices");
    for (const pid of affected) this.send(pid, this.you(pid, { revote: true }));
    return affected;
  }
  toggleReveal() {
    this.question.revealed = !this.question.revealed;
    this.onChange("reveal"); // projector only: participants never receive the breakdown
  }
  close() { if (this.question.open) { this.question.open = false; this.changed("open"); } }
  reopen() { if (!this.question.open) { this.question.open = true; this.changed("open"); } }
  /**
   * Archives the current question (unless it is blank and unanswered) and starts a new one (results hidden,
   * Yes / No), or, given a past question's id, makes that question current again with its votes.
   */
  next(qid = null) {
    const past = qid ? this.history.find((q) => q.id === qid) : null;
    if (qid && (!past || past.tally)) return false; // imported questions have no votes to continue from
    const cur = this.question;
    if (cur.text.trim() || Object.keys(cur.votes).length)
      this.history.push({ ...cur, open: false, revealed: false, joined: this.joined, closedAt: this.now() });
    this.history = this.history.filter((q) => q.id !== qid);
    if (past) {
      const { joined: _joined, closedAt: _closedAt, queued: _queued, ...q } = past;
      this.question = { ...q, open: true, revealed: false };
    } else this.question = blankQuestion();
    this.changed("question");
    if (past) {
      // Participants must learn the question before their own vote on it, so send the state now
      this.broadcast();
      for (const pid of Object.keys(past.votes)) this.send(pid, this.you(pid));
    }
    return true;
  }

  /**
   * Adds questions read from a saved TSV to the history, for viewing only. Questions this session already
   * holds (current or past, with their votes) are kept as they are. Returns the number added or refreshed.
   */
  importHistory(questions) {
    const live = new Set([this.question.id, ...this.history.filter((q) => !q.tally).map((q) => q.id)]);
    const added = questions.filter((q) => !live.has(q.id));
    const ids = new Set(added.map((q) => q.id));
    this.history = [...this.history.filter((q) => !ids.has(q.id)), ...added].sort((a, b) => a.closedAt - b.closedAt);
    if (added.length) this.onChange("history"); // presenter only: nothing to broadcast
    return added.length;
  }

  /** A consistent, immutable copy of a question (default: the current one) and its counts, taken synchronously. */
  snapshot(at = new Date(), qid = this.question.id) {
    const q = this.find(qid), counts = this.counts(q);
    return {
      at,
      question_id: q.id,
      question: q.text,
      total: this.responsesOf(q),
      joined: q.joined ?? this.joined,
      choices: q.choices.map((c) => ({ id: c.id, text: c.text, count: counts[c.id] })),
    };
  }

  serialize() { return JSON.stringify({ v: 1, participants: this.participants, question: this.question, history: this.history, rev: this.rev }); }
  restore(json) {
    const data = JSON.parse(json);
    if (data?.v !== 1 || !data.question?.id || !Array.isArray(data.question.choices)) return false;
    this.participants = data.participants ?? {};
    this.question = { votes: {}, seq: {}, open: true, revealed: false, ...data.question };
    this.history = Array.isArray(data.history) ? data.history : [];
    this.rev = Number(data.rev) || 0;
    return true;
  }
}

// ---------- Participant ----------

class PollParticipant {
  /**
   * @param {{id:string, send:(data:any)=>boolean, onChange?:(kind:string)=>void, seq?:number, onSeq?:(n:number)=>void}} options
   * `seq` is the last vote sequence number used (persist it with `onSeq` so reloads never reuse one).
   */
  constructor({ id, send, onChange = () => {}, seq = 0, onSeq = () => {} }) {
    Object.assign(this, { id, send, onChange, seq, onSeq });
    /** @type {{id:string, text:string, choices:{id:string,text:string}[], open:boolean}|null} */ this.question = null;
    this.rev = 0; this.responses = 0; this.joined = 0; this.connected = 0;
    /** @type {string|null} */ this.mine = null;
    /** @type {{qid:string, cid:string, n:number}|null} */ this.pending = null;
    this.revote = false;
  }

  hello() {
    this.send({ t: "hello", id: this.id });
    this.resend();
  }
  ping() { this.send({ t: "ping", id: this.id }); }
  bye() { this.send({ t: "bye", id: this.id }); }

  vote(cid) {
    if (!this.question?.open || !this.question.choices.some((c) => c.id === cid)) return false;
    this.seq = Math.max(this.seq + 1, Date.now());
    this.onSeq(this.seq);
    this.pending = { qid: this.question.id, cid, n: this.seq };
    this.mine = cid; // optimistic; the presenter's acknowledgement confirms it
    this.revote = false;
    this.resend();
    this.onChange("vote");
    return true;
  }

  /** Resends an unacknowledged vote (after reconnects, or while voting was paused). */
  resend() {
    const p = this.pending;
    if (p && p.qid === this.question?.id && this.question.open) this.send({ t: "vote", id: this.id, ...p });
  }

  /** Handles a verified presenter message. */
  receive(data) {
    if (!data || typeof data !== "object" || !(Number(data.rev) >= this.rev)) return; // ignore delayed messages
    if (data.t === "state" && data.q?.id) {
      this.rev = data.rev;
      const changedQuestion = this.question?.id !== data.q.id;
      this.question = data.q;
      Object.assign(this, { responses: data.responses, joined: data.joined, connected: data.connected });
      if (changedQuestion) { this.mine = null; this.revote = false; if (this.pending?.qid !== data.q.id) this.pending = null; }
      if (this.mine && !data.q.choices.some((c) => c.id === this.mine)) this.mine = null;
      if (this.pending) this.resend(); // e.g. it reached the presenter while voting was paused; duplicates are ignored
      if (data.ask) setTimeout(() => this.hello(), Math.random() * 1500); // presenter reloaded: re-announce, spread out
      this.onChange(changedQuestion ? "question" : "state");
    } else if (data.t === "you") {
      if (data.qid !== this.question?.id) return; // the matching state message will follow
      this.rev = data.rev;
      const p = this.pending;
      if (p && p.qid === data.qid && data.n < p.n) return; // our newer vote is still in flight
      if (p && data.n >= p.n) this.pending = null;
      this.mine = data.cid;
      this.revote = !!data.revote;
      this.onChange("you");
    }
  }
}

// ---------- TSV ----------

const HEADER = ["timestamp", "question", "choice", "count", "total", "question_id"];
const EXTRA = ["choice_id", "joined"];

/** Tabs and newlines would break the TSV structure: collapse them to a single space. */
const clean = (value) => String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();

const pad = (n) => String(n).padStart(2, "0");
/** ISO 8601 with the local time zone offset, e.g. 2026-10-26T18:32:10+01:00 */
function isoLocal(d = new Date()) {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-", abs = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
const fileName = (d = new Date()) =>
  `poll-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.tsv`;

/** Splits a TSV into header and data lines. Throws if the header does not start with the expected columns. */
function parseTSV(content) {
  const lines = String(content ?? "").replace(/^﻿/, "").split(/\r?\n/);
  while (lines.length && lines.at(-1) === "") lines.pop();
  if (!lines.length) return { header: [...HEADER, ...EXTRA], lines: [] };
  const header = lines[0].split("\t").map((h) => h.trim());
  if (HEADER.some((h, i) => header[i] !== h))
    throw new Error(`This file's header is not a poll TSV. Expected the first columns to be: ${HEADER.join(", ")}. Found: ${header.slice(0, 6).join(", ") || "(empty)"}`);
  return { header, lines: lines.slice(1) };
}

/**
 * Returns `content` with the snapshot's rows replacing any rows that have the same question_id.
 * All other lines are kept unchanged and in order. New questions are appended.
 */
function mergeTSV(content, snap) {
  const { header, lines } = parseTSV(content);
  const qcol = header.indexOf("question_id");
  const values = (c) => ({
    timestamp: isoLocal(snap.at), question: snap.question, choice: c.text, count: c.count, total: snap.total,
    question_id: snap.question_id, choice_id: c.id, joined: snap.joined,
  });
  const rows = snap.choices.map((c) => { const v = values(c); return header.map((h) => clean(v[h])).join("\t"); });
  const out = [];
  let inserted = false;
  for (const line of lines) {
    if (line.split("\t")[qcol] === snap.question_id) {
      if (!inserted) { out.push(...rows); inserted = true; }
    } else out.push(line);
  }
  if (!inserted) out.push(...rows);
  return [header.join("\t"), ...out].join("\n") + "\n";
}

/** Reads saved questions from a poll TSV, grouped by question_id, as view-only history entries. */
function pastQuestions(content) {
  const { header, lines } = parseTSV(content);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const byId = new Map();
  for (const line of lines) {
    const cells = line.split("\t"), get = (name) => cells[col[name]] ?? "";
    const id = get("question_id");
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        id, text: get("question"), choices: [], votes: {}, seq: {}, tally: {}, open: false, revealed: false,
        total: Number(get("total")) || 0, joined: Number(get("joined")) || Number(get("total")) || 0,
        closedAt: Date.parse(get("timestamp")) || 0,
      });
    }
    const q = byId.get(id), cid = get("choice_id") || `c${q.choices.length}`;
    q.choices.push({ id: cid, text: get("choice") });
    q.tally[cid] = Number(get("count")) || 0;
  }
  return [...byId.values()];
}

// ---------- Results file ----------

/**
 * Writes snapshots to one TSV per session via the File System Access API. Where that is unsupported,
 * keeps a cumulative TSV in memory and downloads the whole file on every save.
 */
const TSV_TYPES = [{ description: "Tab-separated values", accept: { "text/tab-separated-values": [".tsv"] } }];

class ResultsFile {
  /** @param {{win?:any, download?:(name:string, text:string)=>void, fallback?:{name:string, text:string}|null, onFallback?:(state:{name:string, text:string})=>void}} options */
  constructor({ win = globalThis, download = () => {}, fallback = null, onFallback = () => {} } = {}) {
    Object.assign(this, { win, download, onFallback });
    this.supported = typeof win.showSaveFilePicker === "function" && typeof win.showOpenFilePicker === "function";
    /** @type {any} */ this.handle = null;
    this.name = fallback?.name ?? "";
    this.text = fallback?.text ?? "";
  }

  /** Asks where to save, suggesting poll-YYYY-MM-DD-HH-MM-SS.tsv. save() refuses a non-empty existing file. */
  async pickSaveFile(now = new Date()) {
    const handle = await this.win.showSaveFilePicker({ id: "poll", suggestedName: fileName(now), types: TSV_TYPES });
    this.handle = handle;
    this.name = handle.name;
    return handle.name;
  }

  /** Picks an existing TSV to update. Rejects it (keeping the current file) if its header is invalid. */
  async pickFile() {
    const [handle] = await this.win.showOpenFilePicker({ id: "poll", types: TSV_TYPES });
    const content = await (await handle.getFile()).text();
    parseTSV(content);
    this.handle = handle;
    this.name = handle.name;
    return content;
  }

  /** Fallback: starts the cumulative download from an existing TSV (read with File.text()). */
  async importFile(file) {
    const content = await file.text();
    parseTSV(content);
    this.text = content;
    this.name = file.name;
    this.onFallback({ name: this.name, text: this.text });
    return content;
  }

  /** Saves a snapshot. Throws (without writing) on cancel, permission denial, or an invalid header. */
  async save(snap) {
    if (!this.supported) {
      this.name ||= fileName(snap.at);
      const next = mergeTSV(this.text, snap);
      this.download(this.name, next);
      this.text = next; // keep only once the download was handed to the browser
      this.onFallback({ name: this.name, text: this.text });
      return { mode: "download", name: this.name };
    }
    const picked = !this.handle;
    if (picked) await this.pickSaveFile(snap.at);
    const handle = this.handle;
    const options = { mode: "readwrite" };
    let next;
    try {
      if ((await handle.queryPermission?.(options)) !== "granted" && handle.requestPermission && (await handle.requestPermission(options)) !== "granted")
        throw new Error(`Permission to write ${handle.name} was denied.`);
      const content = await (await handle.getFile()).text();
      // The save dialog lets people pick an existing file. Only "Open TSV…" may update one, to avoid overwrites.
      if (picked && content.length)
        throw new Error(`${handle.name} already exists. To add to it, use "Open TSV…". Otherwise, save under a new name.`);
      next = mergeTSV(content, snap);
    } catch (error) {
      if (picked) Object.assign(this, { handle: null, name: "" }); // let the next save ask for another file
      throw error;
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(next);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => {});
      throw error;
    }
    return { mode: "file", name: handle.name };
  }
}

export { parseSeedMarkdown, pastQuestions, ROOM, ID, LIMITS, ONLINE_MS, PING_MS, topics, uid, blankQuestion, PollHost, PollParticipant, HEADER, EXTRA, clean, isoLocal, fileName, parseTSV, mergeTSV, ResultsFile };
