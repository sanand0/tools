import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const el = (id) => document.getElementById(id);
const toNodes = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return [...t.content.childNodes];
};
const setHTML = (node, html) => node.replaceChildren(...toNodes(html));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uuid = () => Math.random().toString(36).slice(2);
const now = () => Date.now();
const timeAgo = (t) => {
  let s = Math.floor((now() - t) / 1000);
  const units = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [30, "d"],
    [12, "mo"],
    [Number.MAX_SAFE_INTEGER, "y"],
  ];
  for (const [l, u] of units) {
    if (s < l) return s + u;
    s = Math.floor(s / l);
  }
};

let currentUser = JSON.parse(localStorage.getItem("threadchat-user") || "null");
const db = { users: [], posts: [] };

function seed() {
  const u1 = { id: uuid(), name: "alice", pass: "a", created: now(), karma: 1 };
  const u2 = { id: uuid(), name: "bob", pass: "b", created: now(), karma: 0 };
  const c1 = { id: uuid(), user: u2.id, text: "Nice!", time: now(), score: 1, voters: [u1.id], replies: [] };
  const p1 = {
    id: uuid(),
    user: u1.id,
    title: "Welcome to ThreadChat",
    url: "",
    text: "Start a discussion",
    time: now(),
    score: 1,
    voters: [u2.id],
    comments: [c1],
  };
  db.users.push(u1, u2);
  db.posts.push(p1);
}
seed();

function saveSession() {
  currentUser
    ? localStorage.setItem("threadchat-user", JSON.stringify(currentUser))
    : localStorage.removeItem("threadchat-user");
}

const navUser = el("nav-user"),
  content = el("content"),
  loading = el("loading");
const showLoading = () => loading.classList.remove("d-none");
const hideLoading = () => loading.classList.add("d-none");

function renderNavbar() {
  const html = currentUser
    ? `<li class="nav-item"><a class="nav-link" id="new-post-link">New</a></li>
       <li class="nav-item"><a class="nav-link" id="profile-link">${esc(currentUser.name)}</a></li>
       <li class="nav-item"><a class="nav-link" id="logout-link">Logout</a></li>`
    : `<li class="nav-item"><a class="nav-link" data-bs-toggle="modal" data-bs-target="#sign-in-modal">Sign in</a></li>
       <li class="nav-item"><a class="nav-link" data-bs-toggle="modal" data-bs-target="#sign-up-modal">Sign up</a></li>`;
  setHTML(navUser, html);
}

function countComments(cs) {
  let n = 0;
  const rec = (a) =>
    a.forEach((c) => {
      n++;
      if (c.replies.length) rec(c.replies);
    });
  rec(cs);
  return n;
}
function lastUpdated(p) {
  const t = [p.time];
  const rec = (a) =>
    a.forEach((c) => {
      t.push(c.time);
      if (c.replies.length) rec(c.replies);
    });
  rec(p.comments);
  return Math.max(...t);
}
const userName = (id) => db.users.find((u) => u.id === id).name;

async function renderPosts() {
  showLoading();
  await new Promise((r) => setTimeout(r, 300));
  hideLoading();
  db.posts.sort((a, b) => b.score - a.score);
  let html = currentUser
    ? `<div class="mb-3"><a href="#" id="open-post-modal" class="btn btn-primary btn-sm">Submit</a></div>`
    : "";
  for (const p of db.posts) {
    const domain = p.url ? new URL(p.url).hostname : "";
    const comments = countComments(p.comments);
    html += `<div class="mb-3">
      <div><button class="btn btn-sm btn-outline-secondary upvote" data-post="${p.id}">▲</button>
        ${p.url ? `<a href="${p.url}" target="_blank" class="text-decoration-none post-title" data-post="${p.id}">${esc(p.title)}</a>` : `<a href="#" class="post-title" data-post="${p.id}">${esc(p.title)}</a>`}
        ${domain ? `<small class="text-muted">(${domain})</small>` : ""}</div>
      <div class="text-muted small ms-4">${p.score} points by <a href="#" class="profile-link" data-user="${p.user}">${esc(userName(p.user))}</a> ${timeAgo(lastUpdated(p))} | <a href="#" class="post-title" data-post="${p.id}">${comments} comments</a></div>
    </div>`;
  }
  setHTML(content, html || "<p>No posts yet.</p>");
}

function commentHTML(c, postId) {
  return `<div class="ms-4 mb-2" data-comment="${c.id}">
    <div><button class="btn btn-sm btn-outline-secondary upvote" data-comment="${c.id}" data-post="${postId}">▲</button> ${esc(c.text)}</div>
    <div class="text-muted small">by <a href="#" class="profile-link" data-user="${c.user}">${esc(userName(c.user))}</a> ${timeAgo(c.time)} |
      <a href="#" class="reply-link" data-post="${postId}" data-parent="${c.id}">reply</a> |
      <a href="#" class="collapse-link" data-target="${c.id}">[-]</a></div>
    <div id="replies-${c.id}">${c.replies.map((r) => commentHTML(r, postId)).join("")}</div>
  </div>`;
}

async function renderThread(id) {
  const p = db.posts.find((x) => x.id === id);
  if (!p) return;
  showLoading();
  await new Promise((r) => setTimeout(r, 300));
  hideLoading();
  const domain = p.url ? new URL(p.url).hostname : "";
  const html = `<div class="mb-3">
      <div><button class="btn btn-sm btn-outline-secondary upvote" data-post="${p.id}">▲</button>
        ${p.url ? `<a href="${p.url}" target="_blank" class="text-decoration-none">${esc(p.title)}</a>` : esc(p.title)}
        ${domain ? `<small class="text-muted">(${domain})</small>` : ""}</div>
      <div class="text-muted small ms-4">${p.score} points by <a href="#" class="profile-link" data-user="${p.user}">${esc(userName(p.user))}</a> ${timeAgo(p.time)}</div>
      ${p.text ? `<p class="ms-4">${esc(p.text)}</p>` : ""}
      <div class="ms-4 mb-3"><a href="#" class="reply-link" data-post="${p.id}" data-parent="">add comment</a></div>
    </div>
    <div id="comments">${p.comments.map((c) => commentHTML(c, p.id)).join("")}</div>
    <div class="mt-3"><a href="#" id="back-link">Back</a></div>`;
  setHTML(content, html);
}

function findComment(cs, id) {
  for (const c of cs) {
    if (c.id === id) return c;
    const f = findComment(c.replies, id);
    if (f) return f;
  }
}
function addComment(postId, parentId, text) {
  const p = db.posts.find((x) => x.id === postId);
  if (!p) return;
  const c = { id: uuid(), user: currentUser.id, text, time: now(), score: 0, voters: [], replies: [] };
  if (!parentId) p.comments.push(c);
  else findComment(p.comments, parentId).replies.push(c);
}
function addPost(title, url, text) {
  db.posts.push({
    id: uuid(),
    user: currentUser.id,
    title,
    url,
    text,
    time: now(),
    score: 0,
    voters: [],
    comments: [],
  });
}

function vote(postId, commentId) {
  if (!currentUser) {
    bootstrapAlert({ title: "Auth", body: "Please sign in", color: "danger" });
    return;
  }
  const item = commentId
    ? findComment(db.posts.find((p) => p.id === postId).comments, commentId)
    : db.posts.find((p) => p.id === postId);
  if (!item || item.user === currentUser.id || item.voters.includes(currentUser.id)) return;
  item.score++;
  item.voters.push(currentUser.id);
  const owner = db.users.find((u) => u.id === item.user);
  owner.karma++;
}

function renderProfile(id) {
  const u = db.users.find((x) => x.id === id);
  if (!u) return;
  const subs =
    db.posts
      .filter((p) => p.user === id)
      .slice(-5)
      .map((p) => `<li>${esc(p.title)}</li>`)
      .join("") || "<li>None</li>";
  const comments = [];
  const collect = (cs) =>
    cs.forEach((c) => {
      if (c.user === id) comments.push(c);
      if (c.replies.length) collect(c.replies);
    });
  db.posts.forEach((p) => collect(p.comments));
  const comm =
    comments
      .slice(-5)
      .map((c) => `<li>${esc(c.text)}</li>`)
      .join("") || "<li>None</li>";
  setHTML(
    el("profile-body"),
    `<p>${esc(u.name)}<br/>Joined ${timeAgo(u.created)} ago<br/>Karma ${u.karma}</p><h6>Posts</h6><ul>${subs}</ul><h6>Comments</h6><ul>${comm}</ul>`,
  );
  bootstrap.Modal.getOrCreateInstance(el("profile-modal")).show();
}

document.addEventListener("submit", (e) => {
  if (e.target.id === "sign-in-form") {
    e.preventDefault();
    const name = el("sign-in-name").value.trim(),
      pass = el("sign-in-pass").value.trim();
    const u = db.users.find((x) => x.name === name && x.pass === pass);
    if (!u) {
      bootstrapAlert({ title: "Error", body: "Invalid login", color: "danger" });
      return;
    }
    currentUser = u;
    saveSession();
    bootstrap.Modal.getInstance(el("sign-in-modal")).hide();
    renderNavbar();
    renderPosts();
  } else if (e.target.id === "sign-up-form") {
    e.preventDefault();
    const name = el("sign-up-name").value.trim(),
      pass = el("sign-up-pass").value.trim();
    if (!name || !pass) return;
    if (db.users.some((u) => u.name === name)) {
      bootstrapAlert({ title: "Error", body: "Name taken", color: "danger" });
      return;
    }
    currentUser = { id: uuid(), name, pass, created: now(), karma: 0 };
    db.users.push(currentUser);
    saveSession();
    bootstrap.Modal.getInstance(el("sign-up-modal")).hide();
    renderNavbar();
    renderPosts();
  } else if (e.target.id === "post-form") {
    e.preventDefault();
    const title = el("post-title").value.trim(),
      url = el("post-url").value.trim(),
      text = el("post-text").value.trim();
    if (!title) return;
    addPost(title, url, text);
    bootstrap.Modal.getInstance(el("post-modal")).hide();
    renderPosts();
  } else if (e.target.classList.contains("comment-form")) {
    e.preventDefault();
    const txt = e.target.querySelector("textarea").value.trim();
    if (!txt) return;
    const postId = e.target.dataset.post,
      parentId = e.target.dataset.parent;
    addComment(postId, parentId, txt);
    renderThread(postId);
  }
});

document.addEventListener("click", (e) => {
  if (e.target.matches(".post-title")) {
    e.preventDefault();
    renderThread(e.target.dataset.post);
  } else if (e.target.id === "back-link") {
    e.preventDefault();
    renderPosts();
  } else if (e.target.classList.contains("upvote")) {
    e.preventDefault();
    vote(e.target.dataset.post, e.target.dataset.comment);
    renderThread(e.target.dataset.post);
  } else if (e.target.classList.contains("reply-link")) {
    e.preventDefault();
    if (!currentUser) {
      bootstrapAlert({ title: "Auth", body: "Please sign in", color: "danger" });
      return;
    }
    const form = `<form class="comment-form mt-2" data-post="${e.target.dataset.post}" data-parent="${e.target.dataset.parent}"><textarea class="form-control mb-2" rows="2"></textarea><button class="btn btn-sm btn-primary">Post</button></form>`;
    e.target.insertAdjacentHTML("afterend", form);
  } else if (e.target.classList.contains("collapse-link")) {
    e.preventDefault();
    el("replies-" + e.target.dataset.target).classList.toggle("d-none");
  } else if (e.target.id === "logout-link") {
    e.preventDefault();
    currentUser = null;
    saveSession();
    renderNavbar();
    renderPosts();
  } else if (e.target.id === "profile-link" || e.target.classList.contains("profile-link")) {
    e.preventDefault();
    renderProfile(e.target.dataset.user || currentUser.id);
  } else if (e.target.id === "open-post-modal" || e.target.id === "new-post-link") {
    e.preventDefault();
    bootstrap.Modal.getOrCreateInstance(el("post-modal")).show();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
  renderPosts();
});
