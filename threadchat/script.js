import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
if (!window.indexedDB) {
  if (!globalThis.structuredClone) globalThis.structuredClone = (o) => JSON.parse(JSON.stringify(o));
  const f = await import("https://cdn.jsdelivr.net/npm/fake-indexeddb@5/+esm");
  Object.assign(window, f);
}

const DB_NAME = "threadchat";
let db;

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore("users", { keyPath: "name" });
      d.createObjectStore("posts", { keyPath: "id", autoIncrement: true }).createIndex("time", "time");
      const c = d.createObjectStore("comments", { keyPath: "id", autoIncrement: true });
      c.createIndex("post", "post");
      c.createIndex("parent", "parent");
      const v = d.createObjectStore("votes", { keyPath: ["kind", "item", "by"] });
      v.createIndex("item", ["kind", "item"]);
      d.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => ((db = req.result), resolve(db));
    req.onerror = () => reject(req.error);
  });
}

async function tx(names, mode = "readonly") {
  const d = await openDB();
  return d.transaction(names, mode);
}

function store(t, name) {
  return t.objectStore(name);
}
function getAll(s, q) {
  return new Promise((r) => {
    const req = q !== undefined ? s.getAll(q) : s.getAll();
    req.onsuccess = () => r(req.result);
  });
}

async function hash(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function user() {
  return localStorage.getItem("threadchat-user");
}
function setUser(name) {
  name ? localStorage.setItem("threadchat-user", name) : localStorage.removeItem("threadchat-user");
}

async function seed() {
  const t = await tx(["meta"], "readwrite");
  const m = store(t, "meta");
  const done = await new Promise((r) => {
    const g = m.get("seeded");
    g.onsuccess = () => r(g.result);
  });
  if (done) return;
  const tt = await tx(["users", "posts", "comments", "votes", "meta"], "readwrite");
  const u = store(tt, "users");
  const p = store(tt, "posts");
  const c = store(tt, "comments");
  await new Promise((r) => {
    const req = u.put({ name: "alice", pass: "" });
    req.onsuccess = r;
  });
  const now = Date.now();
  const postId = await new Promise((r) => {
    const req = p.add({ title: "Welcome", url: "", text: "Hello", by: "alice", time: now });
    req.onsuccess = (e) => r(e.target.result);
  });
  await new Promise((r) => {
    const req = c.add({ post: postId, parent: null, text: "First comment", by: "alice", time: now });
    req.onsuccess = r;
  });
  await new Promise((r) => {
    const req = store(tt, "meta").put({ key: "seeded" });
    req.onsuccess = r;
  });
}

async function resetDB() {
  indexedDB.deleteDatabase(DB_NAME);
  db = undefined;
  await openDB();
  await seed();
  route();
}

function spinner() {
  return '<div class="d-flex justify-content-center my-3"><div class="spinner-border"></div></div>';
}

async function signup(e) {
  e.preventDefault();
  const name = document.getElementById("signup-user").value.trim();
  const pass = document.getElementById("signup-pass").value;
  if (!name || !pass) return;
  const exists = await new Promise(async (r) => {
    const req = store(await tx(["users"]), "users").get(name);
    req.onsuccess = () => r(req.result);
  });
  if (exists) return bootstrapAlert({ title: "Error", body: "User exists", color: "danger" });
  const hashed = await hash(pass);
  await new Promise(async (r) => {
    const req = store(await tx(["users"], "readwrite"), "users").put({ name, pass: hashed, created: Date.now() });
    req.onsuccess = r;
  });
  setUser(name);
  bootstrapAlert({ title: "Welcome", body: name });
  document.getElementById("signup-form").reset();
  const m = bootstrap.Modal.getInstance(document.getElementById("signup-modal"));
  if (m) m.hide();
  renderAuth();
  route();
}

async function signin(e) {
  e.preventDefault();
  const name = document.getElementById("signin-user").value.trim();
  const pass = document.getElementById("signin-pass").value;
  const t = await tx(["users"]);
  const s = store(t, "users");
  const userObj = await new Promise((r) => {
    const req = s.get(name);
    req.onsuccess = () => r(req.result);
  });
  if (!userObj) return bootstrapAlert({ title: "Error", body: "No such user", color: "danger" });
  const hashed = await hash(pass);
  if (userObj.pass !== hashed) return bootstrapAlert({ title: "Error", body: "Bad password", color: "danger" });
  setUser(name);
  bootstrapAlert({ title: "Hi", body: name });
  document.getElementById("signin-form").reset();
  const m = bootstrap.Modal.getInstance(document.getElementById("signin-modal"));
  if (m) m.hide();
  renderAuth();
  route();
}

function signout() {
  setUser();
  renderAuth();
  route();
}

function renderAuth() {
  const area = document.getElementById("auth-area");
  area.replaceChildren();
  const u = user();
  if (!u) {
    area.insertAdjacentHTML(
      "beforeend",
      '<button class="btn btn-outline-light" data-bs-toggle="modal" data-bs-target="#signup-modal">Sign up</button>',
    );
    area.insertAdjacentHTML(
      "beforeend",
      '<button class="btn btn-outline-light" data-bs-toggle="modal" data-bs-target="#signin-modal">Sign in</button>',
    );
  } else {
    area.insertAdjacentHTML("beforeend", `<span class="navbar-text">${u}</span>`);
    area.insertAdjacentHTML("beforeend", '<button class="btn btn-outline-light" id="signout-btn">Sign out</button>');
    document.getElementById("signout-btn").onclick = signout;
  }
}

async function addPost(e) {
  e.preventDefault();
  const title = document.getElementById("submit-title").value.trim();
  const url = document.getElementById("submit-url").value.trim();
  const text = document.getElementById("submit-text").value.trim();
  if (!title) return;
  const by = user();
  if (!by) return bootstrapAlert({ title: "Error", body: "Sign in first", color: "danger" });
  const t = await tx(["posts"], "readwrite");
  await new Promise((r) => {
    const req = store(t, "posts").add({ title, url, text, by, time: Date.now() });
    req.onsuccess = r;
  });
  location.hash = "#new";
}

async function vote(kind, item) {
  const by = user();
  if (!by) return bootstrapAlert({ title: "Error", body: "Sign in", color: "danger" });
  const t = await tx(["votes"], "readwrite");
  const s = store(t, "votes");
  const key = [kind, item, by];
  const has = await new Promise((r) => {
    const req = s.get(key);
    req.onsuccess = () => r(req.result);
  });
  if (has) return;
  await new Promise((r) => {
    const req = s.put({ kind, item, by });
    req.onsuccess = r;
  });
  route();
}

async function addComment(post, parent, text) {
  const by = user();
  if (!by) return bootstrapAlert({ title: "Error", body: "Sign in", color: "danger" });
  const t = await tx(["comments"], "readwrite");
  await new Promise((r) => {
    const req = store(t, "comments").add({ post, parent, text, by, time: Date.now() });
    req.onsuccess = r;
  });
  route();
}

function fmtTime(t) {
  return new Date(t).toLocaleString();
}

async function postStats(id) {
  const t = await tx(["comments", "votes"]);
  const comments = await getAll(store(t, "comments").index("post"), id);
  const votes = await getAll(store(t, "votes").index("item"), ["post", id]);
  const last = Math.max(0, ...comments.map((c) => c.time));
  return { score: votes.length, comments: comments.length, updated: Math.max(last, (await getPost(id)).time) };
}

async function getPost(id) {
  const t = await tx(["posts"]);
  return await new Promise((r) => {
    const req = store(t, "posts").get(id);
    req.onsuccess = () => r(req.result);
  });
}

async function list(filter) {
  const t = await tx(["posts"]);
  const posts = await getAll(store(t, "posts"));
  const enriched = [];
  for (const p of posts) {
    if (filter === "ask" && p.url) continue;
    if (filter === "show" && !p.url) continue;
    const s = await postStats(p.id);
    enriched.push({ ...p, ...s });
  }
  enriched.sort(filter === "new" ? (a, b) => b.time - a.time : (a, b) => b.score - a.score);
  return enriched;
}

function postHTML(p) {
  const domain = p.url ? new URL(p.url).hostname.replace(/^www\./, "") : "";
  return `<div class="mb-2"><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" data-vote="${p.id}"><i class="bi bi-caret-up"></i></button><a href="#thread-${p.id}">${p.title}</a>${p.url ? `<small class="text-muted">(${domain})</small>` : ""}</div><small class="text-muted">${p.score} points by <a href="#user-${p.by}">${p.by}</a> | ${p.comments} comments | updated ${fmtTime(p.updated)}</small></div>`;
}

async function renderList(filter) {
  const view = document.getElementById("view");
  view.innerHTML = spinner();
  const posts = await list(filter);
  const html = posts.map(postHTML).join("") || "<p>No posts</p>";
  view.innerHTML = `<div>${html}${posts.length ? "" : ""}</div>`;
  view.querySelectorAll("[data-vote]").forEach((btn) => (btn.onclick = () => vote("post", parseInt(btn.dataset.vote))));
}

function commentHTML(c, depth) {
  const pad = depth * 20;
  return `<div style="margin-left:${pad}px" class="mb-2"><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" data-vote="c-${c.id}"><i class="bi bi-caret-up"></i></button><b>${c.by}</b> <small class="text-muted">${fmtTime(c.time)}</small></div><div>${c.text}</div><button class="btn btn-link btn-sm p-0" data-reply="${c.id}">reply</button><div data-children="${c.id}"></div></div>`;
}

async function renderThread(id) {
  const post = await getPost(id);
  if (!post) return;
  const stats = await postStats(id);
  const view = document.getElementById("view");
  view.innerHTML = spinner();
  const head = `<h3>${post.title}</h3><p><a href="${post.url}">${post.url}</a></p><p>${post.text || ""}</p><small class="text-muted">${stats.score} points by <a href="#user-${post.by}">${post.by}</a></small><div class="my-3"><textarea id="new-comment" class="form-control" rows="3"></textarea><button class="btn btn-primary mt-2" id="comment-btn">add comment</button></div><div id="comments"></div>`;
  view.innerHTML = head;
  document.getElementById("comment-btn").onclick = () => {
    const txt = document.getElementById("new-comment").value.trim();
    if (txt) addComment(post.id, null, txt);
  };
  await renderComments(post.id);
}

async function renderComments(postId) {
  const t = await tx(["comments"]);
  const all = await getAll(store(t, "comments").index("post"), postId);
  const root = all.filter((c) => c.parent === null);
  const byParent = {};
  for (const c of all) (byParent[c.parent] || (byParent[c.parent] = [])).push(c);
  const cont = document.getElementById("comments");
  cont.replaceChildren();
  const render = (items, depth) => {
    for (const c of items) {
      cont.insertAdjacentHTML("beforeend", commentHTML(c, depth));
      cont.querySelector(`[data-vote="c-${c.id}"]`).onclick = () => vote("comment", c.id);
      const replyBtn = cont.querySelector(`[data-reply="${c.id}"]`);
      replyBtn.onclick = () => {
        const txt = prompt("reply");
        if (txt) addComment(postId, c.id, txt);
      };
      const children = byParent[c.id] || [];
      if (children.length) render(children, depth + 1);
    }
  };
  render(root, 0);
}

async function renderSubmit() {
  const view = document.getElementById("view");
  view.innerHTML = `<form id="submit-form" class="d-flex flex-column gap-2"><input id="submit-title" class="form-control" placeholder="Title" required /><input id="submit-url" class="form-control" placeholder="URL" /><textarea id="submit-text" class="form-control" rows="3" placeholder="Text"></textarea><button class="btn btn-primary" type="submit">Post</button></form>`;
  const f = document.getElementById("submit-form");
  saveform(f);
  f.onsubmit = addPost;
}

async function renderUser(name) {
  const t = await tx(["users", "posts", "comments", "votes"]);
  const u = await new Promise((r) => {
    const req = store(t, "users").get(name);
    req.onsuccess = () => r(req.result);
  });
  if (!u) return;
  const posts = (await getAll(store(t, "posts").index("time"))).filter((p) => p.by === name);
  const comments = (await getAll(store(t, "comments"))).filter((c) => c.by === name);
  let karma = 0;
  for (const p of posts) karma += (await getAll(store(t, "votes").index("item"), ["post", p.id])).length;
  for (const c of comments) karma += (await getAll(store(t, "votes").index("item"), ["comment", c.id])).length;
  const view = document.getElementById("view");
  const htmlPosts = posts.map((p) => `<li><a href="#thread-${p.id}">${p.title}</a></li>`).join("");
  const htmlComments = comments.map((c) => `<li>${c.text}</li>`).join("");
  view.innerHTML = `<h3>${name}</h3><p>Joined ${fmtTime(u.created)}</p><p>Karma ${karma}</p><h5>Posts</h5><ul>${htmlPosts}</ul><h5>Comments</h5><ul>${htmlComments}</ul><button id="reset-btn" class="btn btn-danger btn-sm">Reset DB</button>`;
  document.getElementById("reset-btn").onclick = resetDB;
}

async function route() {
  await seed();
  const hash = location.hash || "#top";
  if (hash.startsWith("#thread-")) return renderThread(parseInt(hash.split("-")[1]));
  if (hash.startsWith("#user-")) return renderUser(hash.split("-")[1]);
  if (hash === "#submit") return renderSubmit();
  if (["#top", "#new", "#ask", "#show"].includes(hash)) return renderList(hash.slice(1));
  renderList("top");
}

renderAuth();
window.addEventListener("hashchange", route);
document.getElementById("signup-form").onsubmit = signup;
document.getElementById("signin-form").onsubmit = signin;
setTimeout(route);
