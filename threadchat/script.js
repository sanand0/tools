import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";

const main = document.getElementById("main");
const signUpBtn = document.getElementById("sign-up-btn");
const signInBtn = document.getElementById("sign-in-btn");
const logoutBtn = document.getElementById("logout-btn");
const openaiConfigBtn = document.getElementById("openai-config-btn");
const signupModal = new bootstrap.Modal("#signup-modal");
const signinModal = new bootstrap.Modal("#signin-modal");
const signupForm = document.getElementById("signup-form");
const signinForm = document.getElementById("signin-form");

let session = null,
  postSeq = 2,
  commentSeq = 2,
  currentPost,
  listCount = 10;
const db = {
  users: { demo: { pwd: "demo", created: Date.now() } },
  posts: [
    {
      id: 1,
      title: "Welcome to ThreadChat",
      text: "Start the conversation!",
      author: "demo",
      time: Date.now() - 3600000,
      voters: ["demo"],
      comments: [
        {
          id: 1,
          parent: null,
          author: "demo",
          text: "First comment!",
          time: Date.now() - 1800000,
          voters: ["demo"],
          children: [],
        },
      ],
      last: Date.now() - 1800000,
    },
  ],
};

const timeAgo = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return `${s | 0}s ago`;
  if (s < 3600) return `${(s / 60) | 0}m ago`;
  if (s < 86400) return `${(s / 3600) | 0}h ago`;
  return `${(s / 86400) | 0}d ago`;
};
const countComments = (l) => l.reduce((a, c) => a + 1 + countComments(c.children), 0);
const findComment = (l, id) => {
  for (const c of l) {
    if (c.id === id) return c;
    const r = findComment(c.children, id);
    if (r) return r;
  }
};
const gatherComments = (l) => l.flatMap((c) => [c.text, gatherComments(c.children)]).join("\n");

function updateNav() {
  signInBtn.classList.toggle("d-none", !!session);
  signUpBtn.classList.toggle("d-none", !!session);
  logoutBtn.classList.toggle("d-none", !session);
}
function render() {
  location.hash.startsWith("#post-") ? renderThread(+location.hash.slice(6)) : renderList();
}
window.addEventListener("hashchange", render);

function renderList() {
  currentPost = null;
  main.replaceChildren();
  if (!session) bootstrapAlert("info", "Sign up to upvote, comment, and get AI summaries.");
  if (session)
    main.insertAdjacentHTML(
      "beforeend",
      `<form id="post-form" class="mb-3"><input id="post-title" class="form-control mb-2" placeholder="Title"/><input id="post-url" class="form-control mb-2" placeholder="URL (optional)"/><textarea id="post-text" class="form-control mb-2" rows="3" placeholder="Text (optional)"></textarea><button class="btn btn-primary">Submit</button></form>`,
    );
  const posts = [...db.posts].sort((a, b) => b.voters.length - a.voters.length || b.time - a.time);
  const slice = posts
    .slice(0, listCount)
    .map((p) => {
      const d = p.url ? `<small class="text-muted">(${new URL(p.url).hostname})</small>` : "";
      return `<li class="list-group-item d-flex gap-2 align-items-start"><button class="btn btn-link p-0 text-decoration-none upvote-post" data-id="${p.id}"><i class="bi bi-caret-up${session && p.voters.includes(session) ? "-fill" : ""}"></i></button><div><a href="#post-${p.id}" class="fw-bold">${p.title}</a> ${d}<div class="small text-muted">${p.voters.length} points by ${p.author} ${timeAgo(p.last)} | ${countComments(p.comments)} comments</div></div></li>`;
    })
    .join("");
  main.insertAdjacentHTML("beforeend", `<ul class="list-group mb-3">${slice}</ul>`);
  if (posts.length > listCount)
    main.insertAdjacentHTML("beforeend", '<button id="more-btn" class="btn btn-outline-secondary">More</button>');
}

function renderThread(id) {
  currentPost = db.posts.find((x) => x.id === id);
  if (!currentPost) return;
  const p = currentPost;
  main.replaceChildren();
  main.insertAdjacentHTML(
    "beforeend",
    `<div class="mb-3"><h2 class="h4">${p.title}</h2>${p.text ? `<p>${p.text}</p>` : ""}<div class="small text-muted mb-2">${p.voters.length} points by ${p.author} ${timeAgo(p.last)} | ${countComments(p.comments)} comments</div><div class="d-flex gap-2"><button class="btn btn-outline-primary upvote-post" data-id="${p.id}"><i class="bi bi-caret-up${session && p.voters.includes(session) ? "-fill" : ""}"></i> Upvote</button><button id="sum-btn" class="btn btn-outline-secondary"><i class="bi bi-magic me-1"></i>Summarize</button></div></div><div id="summary" class="mb-3"></div><div id="comments"></div>${session ? '<div class="mb-3"><textarea id="comment-text" class="form-control mb-2" rows="3"></textarea><button id="comment-submit" class="btn btn-primary">Comment</button></div>' : ""}`,
  );
  renderComments(p.comments, document.getElementById("comments"));
}

function renderComments(list, container, depth = 0) {
  const html = list
    .map(
      (c) =>
        `<div class="ms-${depth * 2} mb-2" data-id="${c.id}"><div class="small text-muted"><button class="btn btn-link p-0 text-decoration-none upvote-comment" data-id="${c.id}"><i class="bi bi-caret-up${session && c.voters.includes(session) ? "-fill" : ""}"></i></button> ${c.voters.length} by ${c.author} ${timeAgo(c.time)} <a href="#" class="reply-link ms-2">reply</a> <a href="#" class="toggle-link ms-2">[-]</a></div><div class="comment-text">${c.text}</div><div class="children ms-2"></div></div>`,
    )
    .join("");
  container.insertAdjacentHTML("beforeend", html);
  list.forEach((c) =>
    renderComments(c.children, container.querySelector(`div[data-id="${c.id}"] .children`), depth + 1),
  );
}

function addPost(title, url, text) {
  if (!session || !title) return;
  db.posts.push({
    id: postSeq++,
    title,
    url,
    text,
    author: session,
    time: Date.now(),
    voters: [session],
    comments: [],
    last: Date.now(),
  });
  renderList();
}
function addComment(pid, parentId, text) {
  if (!session || !text) return;
  const p = db.posts.find((x) => x.id === pid);
  const comment = {
    id: commentSeq++,
    parent: parentId,
    author: session,
    text,
    time: Date.now(),
    voters: [session],
    children: [],
  };
  parentId ? findComment(p.comments, parentId).children.push(comment) : p.comments.push(comment);
  p.last = comment.time;
  renderThread(pid);
}
function upvotePost(id) {
  if (!session) return bootstrapAlert("info", "Sign in to vote");
  const p = db.posts.find((x) => x.id === id);
  if (!p.voters.includes(session)) p.voters.push(session);
  render();
}
function upvoteComment(id) {
  if (!session) return bootstrapAlert("info", "Sign in to vote");
  const c = findComment(currentPost.comments, id);
  if (!c.voters.includes(session)) c.voters.push(session);
  renderThread(currentPost.id);
}
function showReply(id) {
  if (!session) return bootstrapAlert("info", "Sign in to reply");
  const d = main.querySelector(`div[data-id="${id}"]`);
  if (d.querySelector("textarea")) return;
  d.insertAdjacentHTML(
    "beforeend",
    `<div class="mt-1"><textarea class="form-control mb-1" rows="2"></textarea><button class="btn btn-primary btn-sm reply-submit">Reply</button></div>`,
  );
}
async function summarizeThread(id) {
  const p = db.posts.find((x) => x.id === id);
  const text = [p.title, p.text, gatherComments(p.comments)].filter(Boolean).join("\n");
  const { apiKey, baseUrl } = await openaiConfig({});
  if (!apiKey) return bootstrapAlert("danger", "Missing API key");
  const summary = document.getElementById("summary");
  summary.innerHTML = '<div class="spinner-border"></div>';
  for await (const { content, error } of asyncLLM({
    apiKey,
    baseUrl,
    messages: [
      {
        role: "user",
        content: `Summarize briefly:
${text}`,
      },
    ],
  })) {
    if (error) {
      bootstrapAlert("danger", error);
      break;
    }
    summary.textContent = content;
  }
}

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("signup-user").value.trim();
  const p = document.getElementById("signup-pass").value.trim();
  if (!u || !p || db.users[u]) return;
  db.users[u] = { pwd: p, created: Date.now() };
  session = u;
  signupModal.hide();
  updateNav();
  render();
});
signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("signin-user").value.trim();
  const p = document.getElementById("signin-pass").value.trim();
  if (!db.users[u] || db.users[u].pwd !== p) return bootstrapAlert("danger", "Invalid login");
  session = u;
  signinModal.hide();
  updateNav();
  render();
});
logoutBtn.addEventListener("click", () => {
  session = null;
  updateNav();
  render();
});
openaiConfigBtn.addEventListener("click", async () => {
  await openaiConfig({ show: true });
});
main.addEventListener("submit", (e) => {
  if (e.target.id === "post-form") {
    e.preventDefault();
    addPost(
      document.getElementById("post-title").value.trim(),
      document.getElementById("post-url").value.trim(),
      document.getElementById("post-text").value.trim(),
    );
  }
});
main.addEventListener("click", (e) => {
  const p = e.target.closest(".upvote-post");
  if (p) return upvotePost(+p.dataset.id);
  const c = e.target.closest(".upvote-comment");
  if (c) return upvoteComment(+c.dataset.id);
  if (e.target.id === "comment-submit")
    addComment(currentPost.id, null, document.getElementById("comment-text").value.trim());
  if (e.target.classList.contains("reply-link")) {
    e.preventDefault();
    showReply(+e.target.closest("[data-id]").dataset.id);
  }
  if (e.target.classList.contains("reply-submit")) {
    const d = e.target.closest("[data-id]");
    addComment(currentPost.id, +d.dataset.id, d.querySelector("textarea").value.trim());
  }
  if (e.target.classList.contains("toggle-link")) {
    e.preventDefault();
    const d = e.target.closest("[data-id]");
    d.querySelector(".comment-text").classList.toggle("d-none");
    d.querySelector(".children").classList.toggle("d-none");
  }
  if (e.target.id === "more-btn") {
    listCount += 10;
    renderList();
  }
  if (e.target.id === "sum-btn") summarizeThread(currentPost.id);
});

updateNav();
render();
