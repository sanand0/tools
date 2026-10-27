import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { downloadBlob } from "../common/download.js";
import { MqttClient } from "./mqtt.js";
import { presenterKey, verifier } from "./signing.js";
import { ROOM, ID, PING_MS, topics, uid, parseSeedMarkdown, pastQuestions, PollHost, PollParticipant, ResultsFile } from "./poll.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// Tests inject an in-memory bus here; the deployed page always uses MQTT.
const connect = window.pollTransport ?? ((options) => new MqttClient(options));

const store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const alertError = (title, error) => bootstrapAlert({ title, body: escape(error?.message ?? error), color: "danger" });
const mount = (id) => $("app").replaceChildren($(id).content.cloneNode(true));
const throttle = (fn, ms) => {
  let timer = null;
  return () => { timer ??= setTimeout(() => { timer = null; fn(); }, ms); };
};

function showStatus(status) {
  $("net-status").hidden = false;
  $("net-dot").classList.toggle("live", status === "live");
  $("net-text").textContent = { live: "Live", connecting: "Connecting…", reconnecting: "Reconnecting…", closed: "Offline" }[status] ?? status;
}

async function renderQR(el, url) {
  try {
    const { default: qrcode } = await import("https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/+esm");
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    el.replaceChildren();
    el.insertAdjacentHTML("beforeend", qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: "QR code to join this poll" }));
  } catch {
    el.replaceChildren(Object.assign(document.createElement("div"), { className: "alert alert-warning", textContent: "QR code unavailable. Share the room link." }));
  }
}

const room = (params.get("room") ?? "").toUpperCase();
if (!ROOM.test(room)) landing();
else if (params.has("present")) presenter(room);
else participant(room);

// ---------- Landing ----------
function landing(message = "") {
  mount("landing-template");
  if (message) bootstrapAlert({ body: escape(message), color: "warning" });
  $("create").addEventListener("click", async () => {
    $("create").disabled = true;
    try {
      const seed = parseSeedMarkdown($("seed").value);
      const key = await presenterKey();
      // Only this browser keeps the signing key. The audience link carries just the room code.
      if (!store.set(`poll:key:${key.room}`, key.jwk)) throw new Error("Browser storage is unavailable, so the presenter key cannot be kept.");
      if (seed.length && !store.set(`poll:seed:${key.room}`, seed)) throw new Error("Unable to store the prepared questions.");
      location.search = `?room=${key.room}&present`;
    } catch (error) {
      $("create").disabled = false;
      alertError("Cannot create a room", error?.message ? error : "This browser cannot create signing keys. Open the page over HTTPS.");
    }
  });
  $("join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("join-code").value.toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (ROOM.test(code)) location.search = `?room=${code}`;
    else bootstrapAlert({ body: "Room codes have 8 letters and digits, e.g. K7QPX2MD.", color: "warning" });
  });
}

// ---------- Presenter ----------
async function presenter(room) {
  const jwk = store.get(`poll:key:${room}`);
  const key = jwk ? await presenterKey(jwk).catch(() => null) : null;
  if (!key || key.room !== room)
    return landing(`This browser does not hold the presenter key for room ${room}. Create a new room, or open the presenter link in the browser that created it.`);
  mount("presenter-template");
  document.title = `Live Poll · ${room}`;
  const t = topics(room), joinURL = `${location.origin}${location.pathname}?room=${room}`;
  $("room-code").textContent = room;
  Object.assign($("join-link"), { href: joinURL, textContent: joinURL });
  renderQR($("qr"), joinURL);

  // Sign and publish in order, so participants never see an older state after a newer one.
  let signing = Promise.resolve();
  const deliver = (to, data) => (signing = signing.then(async () => net.publish(to === "all" ? t.all : t.client(to), await key.sign(data))).catch(() => {}));
  const stateKey = `poll:host:${room}`;
  const host = new PollHost({ send: deliver, onChange });
  let restored = false;
  try { const saved = localStorage.getItem(stateKey); if (saved) restored = host.restore(saved); } catch { /* fresh room */ }
  if (!restored) {
    const seed = store.get(`poll:seed:${room}`);
    if (Array.isArray(seed) && seed.length) {
      host.seed(seed);
      if (store.set(stateKey, JSON.parse(host.serialize()))) localStorage.removeItem(`poll:seed:${room}`);
    }
  }
  const broadcast = throttle(() => host.broadcast(), 150);
  const persist = throttle(() => { try { localStorage.setItem(stateKey, host.serialize()); } catch { /* storage full: state stays in memory */ } }, 500);
  const net = connect({
    prefix: "pollh",
    onMessage: (_topic, msg) => host.handle(msg),
    onStatus: showStatus,
    onLive: () => host.broadcast({ ask: true }), // participants re-announce after the presenter reconnects or reloads
  });
  net.subscribe(t.up);
  net.connect();
  setInterval(() => { host.broadcast(); render(); }, 5000);

  const fallbackKey = `poll:fallback:${room}`;
  const results = new ResultsFile({
    win: window,
    download: (name, text) => downloadBlob(new Blob([text], { type: "text/tab-separated-values" }), name),
    fallback: store.get(fallbackKey),
    onFallback: (state) => store.set(fallbackKey, state),
  });

  function onChange(kind) {
    if (kind !== "reveal" && kind !== "history") broadcast(); // both are presenter-only
    persist();
    render(kind);
  }

  // ----- Rendering -----
  const question = $("question");
  const autosize = () => { question.style.height = "auto"; question.style.height = `${question.scrollHeight}px`; };
  // A past question shown only on the projector. Participants keep seeing host.question.
  let view = null, viewRevealed = true, shownId = null;
  function render(kind = "") {
    if (view && !host.find(view)) view = null;
    const q = view ? host.find(view) : host.question, past = !!view;
    if (kind === "question" || shownId !== q.id || question.value !== q.text && document.activeElement !== question) { question.value = q.text; autosize(); }
    shownId = q.id;
    question.readOnly = past;
    const counts = host.counts(q), total = host.responsesOf(q), revealed = past ? viewRevealed : q.revealed;
    const rows = new Map([...$("choices").children].map((row) => [row.dataset.cid, row]));
    for (const [cid, row] of rows) if (!q.choices.some((c) => c.id === cid)) row.remove();
    q.choices.forEach((c, i) => {
      let row = rows.get(c.id);
      if (!row) {
        $("choices").insertAdjacentHTML("beforeend", /* html */ `
          <div class="choice-row">
            <div class="input-group input-group-lg">
              <input class="form-control choice-input" maxlength="80" aria-label="Choice" placeholder="Choice" />
              <button class="btn btn-outline-danger remove-choice" title="Remove choice" aria-label="Remove choice"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="progress bar mt-2" hidden><div class="progress-bar fw-semibold text-start ps-2"></div></div>
          </div>`);
        row = $("choices").lastElementChild;
        row.dataset.cid = c.id;
      }
      if ($("choices").children[i] !== row) $("choices").insertBefore(row, $("choices").children[i]);
      const input = row.querySelector("input");
      if (input.value !== c.text && document.activeElement !== input) input.value = c.text;
      input.readOnly = past;
      row.querySelector(".remove-choice").hidden = past;
      row.querySelector(".remove-choice").disabled = q.choices.length <= 1;
      const pct = total ? Math.round((100 * counts[c.id]) / total) : 0;
      const bar = row.querySelector(".progress");
      bar.hidden = !revealed;
      Object.assign(bar.firstElementChild.style, { width: `${pct}%`, minWidth: "6rem" });
      bar.firstElementChild.classList.toggle("bg-transparent", !counts[c.id]); // no blue bar for zero votes
      bar.firstElementChild.classList.toggle("text-body", !counts[c.id]);
      bar.firstElementChild.textContent = `${counts[c.id]} · ${pct}%`;
    });
    $("add-choice").disabled = q.choices.length >= 12;
    $("add-choice").hidden = past;
    $("tally").textContent = `${total} / ${past && !q.queued ? q.joined : host.joined}`;
    $("reveal").classList.toggle("active", revealed);
    $("reveal").querySelector("span").textContent = revealed ? "Hide results" : "Show results";
    $("voting-state").textContent = past ? "Voting closed" : q.open ? "" : "Voting paused while saving…";
    $("viewing").hidden = !past;
    $("show-past").hidden = !!q.tally; // a question read from a TSV has counts but no votes to continue
    $("viewing-source").textContent = q.tally ? "Saved question from the TSV" : q.queued ? "Ready question" : "Past question";
    $("viewing-tally").textContent = `${host.responses} / ${host.joined}`;
    renderHistory();
    renderFile();
  }

  // ----- Past questions: listed only when the presenter opens the panel -----
  function renderHistory() {
    $("history-toggle").hidden = !host.history.length;
    $("history-count").textContent = String(host.history.length);
    $("history-label").textContent = host.history.some((q) => q.queued) ? "Questions" : "Past";
    $("history-toggle").classList.toggle("active", !$("history").hidden);
    $("history-toggle").setAttribute("aria-expanded", String(!$("history").hidden));
    if ($("history").hidden) return;
    const item = (q, label) => {
      const b = Object.assign(document.createElement("button"), { type: "button", className: `list-group-item list-group-item-action d-flex gap-3 ${q.id === shownId ? "active" : ""}` });
      b.dataset.qid = q.id;
      b.append(
        Object.assign(document.createElement("span"), { className: "me-auto text-truncate", textContent: q.text.trim() || "(blank question)" }),
        Object.assign(document.createElement("small"), { className: "text-nowrap", textContent: label }),
      );
      return b;
    };
    const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $("history").replaceChildren(
      item(host.question, `current · ${host.responses} / ${host.joined}`),
      ...[...host.history.filter((q) => q.queued), ...host.history.filter((q) => !q.queued).toReversed()]
        .map((q) => item(q, q.queued ? "ready" : `${time(q.closedAt)} · ${host.responsesOf(q)} / ${q.joined}`)),
    );
  }
  const showQuestion = (qid) => {
    view = qid && qid !== host.question.id ? qid : null;
    viewRevealed = true; // a past question opens with its results
    $("history").hidden = true;
    render();
  };
  $("history-toggle").addEventListener("click", () => { $("history").hidden = !$("history").hidden; renderHistory(); });
  $("history").addEventListener("click", (e) => {
    const b = e.target.closest("[data-qid]");
    if (b) showQuestion(b.dataset.qid);
  });
  $("back-current").addEventListener("click", () => showQuestion(null));
  $("show-past").addEventListener("click", () => view && advance(view));

  function renderFile() {
    $("pick-file").querySelector("span").textContent = results.supported ? "Open TSV…" : "Import TSV…";
    $("file-status").textContent = results.supported
      ? results.name ? `Saving to ${results.name}` : "Save asks where to save the TSV"
      : `Each save downloads the full ${results.name || "TSV"} (this browser cannot write files directly)`;
  }

  // ----- Editing -----
  question.addEventListener("input", () => { host.setText(question.value); autosize(); });
  $("choices").addEventListener("input", (e) => {
    const row = e.target.closest(".choice-row");
    if (row) host.renameChoice(row.dataset.cid, e.target.value);
  });
  $("choices").addEventListener("click", (e) => {
    const row = e.target.closest(".remove-choice")?.closest(".choice-row");
    if (row) host.removeChoice(row.dataset.cid);
  });
  $("add-choice").addEventListener("click", () => {
    const c = host.addChoice("");
    if (c) $("choices").querySelector(`[data-cid="${c.id}"] input`)?.focus();
  });
  const toggleReveal = () => {
    if (!view) return host.toggleReveal();
    viewRevealed = !viewRevealed;
    render();
  };
  $("reveal").addEventListener("click", toggleReveal);
  document.addEventListener("keydown", (e) => {
    const editable = e.target instanceof Element && (e.target.closest("input, textarea, select") || e.target.isContentEditable);
    if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey && !editable) {
      e.preventDefault();
      toggleReveal();
    }
  });

  // ----- Files -----
  const pick = async (fn) => {
    try { await fn(); } catch (error) { if (error?.name !== "AbortError") alertError("Cannot use this file", error); }
    renderFile();
  };
  // An opened TSV also fills "Past" with its saved questions, so their results can be shown again
  const load = async (content) => { host.importHistory(pastQuestions(content)); };
  $("pick-file").addEventListener("click", () => (results.supported ? pick(async () => load(await results.pickFile())) : $("import-file").click()));
  $("import-file").addEventListener("change", (e) => {
    const [file] = e.target.files;
    e.target.value = "";
    if (file) pick(async () => load(await results.importFile(file)));
  });

  // Saves run one at a time. Each snapshot is taken synchronously when Save or New is pressed.
  let queue = Promise.resolve(), pending = 0;
  function write(snap) {
    const run = queue.then(() => results.save(snap));
    queue = run.catch(() => {});
    pending++;
    $("saving").hidden = false;
    return run.finally(() => { $("saving").hidden = --pending === 0; renderFile(); });
  }
  const failure = (error) => (error?.name === "AbortError" ? new Error("Saving was cancelled.") : error);

  $("save").addEventListener("click", async () => {
    const snap = host.snapshot(new Date(), view ?? host.question.id); // saves the question on screen
    try {
      const { name } = await write(snap);
      bootstrapAlert({ body: `Saved ${snap.choices.length} rows to ${escape(name)}`, color: "success" });
    } catch (error) {
      alertError("Not saved", failure(error));
    }
  });

  /** Saves and archives the current question, then starts a new one (target null) or makes a past one live. */
  let starting = false;
  async function advance(target = null) {
    if (starting) return;
    $("new-failed").replaceChildren();
    const done = () => {
      host.next(target);
      showQuestion(null);
      if (!target) question.focus();
    };
    if (!host.question.text.trim() || (target && host.question.prepared && host.responses === 0)) return done();
    starting = true;
    $("new").disabled = true;
    const at = new Date();
    host.close(); // stop accepting votes before the final snapshot
    host.broadcast();
    const snap = host.snapshot(at);
    try {
      await write(snap);
      done();
    } catch (error) {
      host.reopen(); // keep the question and its votes exactly as they were
      showNewFailure(failure(error), () => advance(target));
    } finally {
      starting = false;
      $("new").disabled = false;
    }
  }
  function showNewFailure(error, retry) {
    const box = Object.assign(document.createElement("div"), { className: "alert alert-danger d-flex flex-wrap gap-2 align-items-center", role: "alert" });
    box.append(
      Object.assign(document.createElement("span"), { className: "me-auto", textContent: `Could not save, so the current question is kept. ${error?.message ?? error}` }),
      Object.assign(document.createElement("button"), { className: "btn btn-sm btn-danger", id: "new-retry", textContent: "Retry" }),
      Object.assign(document.createElement("button"), { className: "btn btn-sm btn-outline-secondary", id: "new-cancel", textContent: "Cancel" }),
    );
    $("new-failed").replaceChildren(box);
    $("new-retry").addEventListener("click", retry);
    $("new-cancel").addEventListener("click", () => $("new-failed").replaceChildren());
  }
  $("new").addEventListener("click", () => advance());

  render("question");
  question.focus();
}

// ---------- Participant ----------
function participant(room) {
  mount("participant-template");
  document.title = `Live Poll · ${room}`;
  const t = topics(room), idKey = `poll:id:${room}`, seqKey = `poll:seq:${room}`;
  let id = store.get(idKey);
  if (typeof id !== "string" || !ID.test(id)) { id = uid("", 16); store.set(idKey, id); } // anonymous, kept across reloads
  $("p-room").textContent = room;
  renderQR($("p-qr"), `${location.origin}${location.pathname}?room=${room}`);

  const verify = verifier(room);
  let chain = Promise.resolve();
  const poll = new PollParticipant({
    id,
    send: (data) => net.publish(t.up, data),
    onChange: render,
    seq: Number(store.get(seqKey)) || 0,
    onSeq: (n) => store.set(seqKey, n),
  });
  const net = connect({
    prefix: "pollp",
    // Only messages signed by the key that hashes to this room code are applied.
    onMessage: (_topic, envelope) => { chain = chain.then(() => verify(envelope)).then((data) => data && poll.receive(data)); },
    onStatus: showStatus,
    onLive: () => poll.hello(),
  });
  net.subscribe(t.all);
  net.subscribe(t.client(id));
  net.connect();
  setInterval(() => poll.resend(), 3000);
  setInterval(() => poll.ping(), PING_MS);
  window.addEventListener("pagehide", () => poll.bye());

  $("p-choices").addEventListener("click", (e) => {
    const button = e.target.closest("[data-cid]");
    if (button) poll.vote(button.dataset.cid);
  });

  function render() {
    const q = poll.question;
    const title = $("p-question");
    if (!q) {
      title.replaceChildren();
      title.insertAdjacentHTML("beforeend", '<span class="spinner-border me-3" role="status"></span><span class="text-secondary">Waiting for the presenter…</span>');
    } else title.textContent = q.text.trim() || "…";
    const list = $("p-choices"), choices = q?.choices ?? [];
    const buttons = new Map([...list.children].map((b) => [b.dataset.cid, b]));
    for (const [cid, b] of buttons) if (!choices.some((c) => c.id === cid)) b.remove();
    choices.forEach((c, i) => {
      let b = buttons.get(c.id);
      if (!b) { b = Object.assign(document.createElement("button"), { type: "button" }); b.dataset.cid = c.id; }
      if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
      b.textContent = c.text || "…";
      b.className = `btn vote-btn ${poll.mine === c.id ? "btn-primary" : "btn-outline-primary"}`;
      b.disabled = !q.open;
      b.setAttribute("aria-pressed", String(poll.mine === c.id));
    });
    $("p-revote").hidden = !poll.revote;
    const mine = choices.find((c) => c.id === poll.mine);
    $("p-mine").textContent = !q ? "" : !q.open ? "Voting paused" : mine ? `${poll.pending ? "Sending" : "Your vote"}: ${mine.text}` : "Tap a choice to vote";
    $("p-tally").textContent = `${poll.responses} / ${poll.joined}`;
  }
  render();
}
