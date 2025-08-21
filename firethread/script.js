/** FireThread: Threaded discussion with Firebase. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

/** @param {string} id */
const el = (id) => document.getElementById(id);
const toNodes = (h) => {
  const t = document.createElement("template");
  t.innerHTML = h.trim();
  return [...t.content.childNodes];
};
const setHTML = (n, h) => n.replaceChildren(...toNodes(h));
const appendHTML = (n, h) => n.insertAdjacentHTML("beforeend", h);
const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const spinner = () => '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
const showLoading = (n) => setHTML(n, spinner());
const toast = (b, c = "danger", t = "") => bootstrapAlert({ title: t, body: b, color: c });

/** Load firebase config */
async function loadConfig() {
  const r = await fetch("./config.json", { cache: "no-store" });
  return (await r.json()).firebase;
}

let auth, db;
async function init() {
  showLoading(el("posts-box"));
  const cfg = await loadConfig();
  const app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async (user) => {
    renderUser(user);
    await renderPosts();
  });
}

async function signIn() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

async function addPost(title, text) {
  const u = auth.currentUser;
  if (!u) return toast("Sign in first");
  try {
    await addDoc(collection(db, "posts"), { title, text, userId: u.uid, createdAt: serverTimestamp() });
  } catch (e) {
    toast(e?.stack || e);
  }
}

async function addComment(postId, parentId, text) {
  const u = auth.currentUser;
  if (!u) return toast("Sign in first");
  try {
    await addDoc(collection(db, "comments"), { postId, parentId, text, userId: u.uid, createdAt: serverTimestamp() });
  } catch (e) {
    toast(e?.stack || e);
  }
}

const mapDocs = (qs) => qs.docs.map((d) => ({ id: d.id, ...d.data() }));
async function getPosts() {
  try {
    return mapDocs(await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"))));
  } catch (e) {
    toast(e?.stack || e);
    return [];
  }
}
async function getComments(postId) {
  try {
    return mapDocs(
      await getDocs(query(collection(db, "comments"), where("postId", "==", postId), orderBy("createdAt"))),
    );
  } catch (e) {
    toast(e?.stack || e);
    return [];
  }
}

function renderUser(user) {
  if (!user) {
    setHTML(
      el("user-box"),
      '<button id="sign-in" class="btn btn-primary btn-sm"><i class="bi bi-google"></i> Sign In</button>',
    );
    el("sign-in").onclick = signIn;
    el("post-form").classList.add("d-none");
    return;
  }
  setHTML(
    el("user-box"),
    `<div class="d-flex align-items-center gap-2"><small class="text-muted">uid: ${escapeHTML(user.uid.slice(0, 8))}</small><button id="sign-out" class="btn btn-outline-secondary btn-sm">Sign Out</button></div>`,
  );
  el("sign-out").onclick = () => auth.signOut();
  el("post-form").classList.remove("d-none");
}

async function renderPosts() {
  const box = el("posts-box");
  showLoading(box);
  const posts = await getPosts();
  if (!posts.length) return setHTML(box, '<div class="alert alert-warning">No posts yet.</div>');
  setHTML(
    box,
    `<ul class="list-group">${posts.map((p) => `<li class="list-group-item"><div class="fw-semibold">${escapeHTML(p.title)}</div><div>${escapeHTML(p.text || "")}</div><small class="text-muted">${escapeHTML(p.userId?.slice(0, 8) || "")}</small><div id="c-${p.id}" class="ms-3 mt-2"></div><button class="btn btn-link btn-sm p-0 mt-2" data-post="${p.id}"><i class="bi bi-reply"></i> reply</button></li>`).join("")}</ul>`,
  );
  posts.forEach(async (p) => {
    const comments = await getComments(p.id);
    setHTML(el(`c-${p.id}`), drawThread(comments, null));
  });
  box
    .querySelectorAll("[data-post]")
    .forEach((btn) => (btn.onclick = () => showCommentForm(btn.dataset.post, btn.dataset.parent, btn)));
}

function drawThread(comments, parentId) {
  const kids = comments.filter((c) => c.parentId === parentId);
  if (!kids.length) return "";
  return `<ul class="list-group ms-3">${kids.map((c) => `<li class="list-group-item"><div>${escapeHTML(c.text)}</div><small class="text-muted">${escapeHTML(c.userId?.slice(0, 8) || "")}</small><button class="btn btn-link btn-sm p-0 ms-2" data-post="${c.postId}" data-parent="${c.id}"><i class="bi bi-reply"></i> reply</button>${drawThread(comments, c.id)}</li>`).join("")}</ul>`;
}

function showCommentForm(postId, parentId, btn) {
  const html = `<div class="mt-2"><textarea class="form-control mb-1" rows="2"></textarea><button class="btn btn-primary btn-sm">Add</button></div>`;
  appendHTML(btn.parentElement, html);
  const div = btn.nextElementSibling;
  const ta = div.querySelector("textarea");
  const add = div.querySelector("button");
  add.onclick = async () => {
    const text = ta.value.trim();
    if (!text) return;
    await addComment(postId, parentId || null, text);
  };
}

el("post-submit").onclick = async () => {
  const title = el("post-title").value.trim();
  const text = el("post-text").value.trim();
  if (!title) return;
  await addPost(title, text);
  el("post-title").value = "";
  el("post-text").value = "";
};

init();
