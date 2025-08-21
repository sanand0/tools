import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
const main = document.getElementById("main");
const navAuth = document.getElementById("nav-auth");
const navUser = document.getElementById("nav-user");
const profileLink = document.getElementById("profile-link");
const spinner = document.getElementById("spinner");
let postSeq = 2;
let commentSeq = 1;
const data = {
  users: { demo: { password: "demo", created: Date.now(), karma: 1 } },
  posts: [
    {
      id: 1,
      title: "Welcome to ThreadChat",
      url: "",
      text: "Share anything!",
      user: "demo",
      time: Date.now() - 36e5,
      score: 5,
    },
    {
      id: 2,
      title: "Example link",
      url: "https://example.com",
      text: "",
      user: "demo",
      time: Date.now() - 72e5,
      score: 2,
    },
  ],
  comments: [
    {
      id: 1,
      postId: 1,
      parentId: null,
      user: "demo",
      text: "First comment!",
      time: Date.now() - 3e6,
      score: 1,
    },
  ],
};
const state = { view: "list", user: null, postId: null, profile: null, page: 1 };
function showError(message) {
  bootstrapAlert({ title: "Error", body: message, color: "danger", replace: true });
}
function timeAgo(time) {
  const diff = Math.floor((Date.now() - time) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function getDomain(u) {
  if (!u) return "";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function toggleSpinner(show) {
  spinner.classList[show ? "remove" : "add"]("d-none");
}
function updateNav() {
  if (state.user) {
    navAuth.classList.add("d-none");
    navUser.classList.remove("d-none");
    profileLink.textContent = state.user;
  } else {
    navAuth.classList.remove("d-none");
    navUser.classList.add("d-none");
  }
}
function getPostComments(id) {
  return data.comments.filter((c) => c.postId === id);
}
function lastUpdated(post) {
  return getPostComments(post.id).reduce((m, c) => Math.max(m, c.time), post.time);
}
function upvote(item, type) {
  if (!state.user) return showError("Please sign in");
  item.score++;
  data.users[item.user].karma++;
  render();
}
function addComment(postId, parentId, text) {
  if (!state.user) return showError("Sign in to comment");
  if (!text.trim()) return;
  commentSeq++;
  data.comments.push({ id: commentSeq, postId, parentId, user: state.user, text, time: Date.now(), score: 0 });
  data.users[state.user].karma++;
  render();
}
function addPost(title, url, text) {
  if (!state.user) return showError("Sign in to submit");
  if (!title.trim()) return showError("Title required");
  if (url && !getDomain(url)) return showError("Invalid URL");
  postSeq++;
  data.posts.push({ id: postSeq, title, url, text, user: state.user, time: Date.now(), score: 0 });
  data.users[state.user].karma++;
  render();
}
function render() {
  updateNav();
  if (state.view === "list") renderList();
  else if (state.view === "thread") renderThread();
  else renderProfile();
}
function renderList() {
  const posts = [...data.posts].sort((a, b) => b.score - a.score || b.time - a.time);
  const visible = posts.slice(0, state.page * 10);
  let html =
    '<div class="mb-2 text-end"><button id="open-submit" class="btn btn-success btn-sm">Submit</button></div><ol class="list-group list-group-numbered">';
  visible.forEach((p) => {
    const comments = getPostComments(p.id);
    const domain = getDomain(p.url);
    const last = timeAgo(lastUpdated(p));
    html += `
      <li class="list-group-item">
        <div class="d-flex">
          <div class="me-2 text-center">
            <button class="btn btn-sm btn-outline-secondary up-post" data-id="${p.id}">▲</button>
            <div>${p.score}</div>
          </div>
          <div>
            <a ${p.url ? `href="${p.url}" target="_blank"` : `href="#" class="open-thread" data-id="${p.id}"`}>${p.title}</a>
            ${domain ? `<small class="text-muted">(${domain})</small>` : ""}
            <div class="small text-muted">
              by <a href="#" class="open-profile" data-user="${p.user}">${p.user}</a>
              • <a href="#" class="open-thread" data-id="${p.id}">${comments.length} comments</a>
              • ${last}
            </div>
          </div>
        </div>
      </li>`;
  });
  html += "</ol>";
  if (visible.length < posts.length) html += '<button id="more-btn" class="btn btn-secondary mt-2">More</button>';
  main.replaceChildren();
  main.insertAdjacentHTML("afterbegin", html);
  main.querySelectorAll(".open-thread").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      state.postId = Number(el.dataset.id);
      state.view = "thread";
      render();
    }),
  );
  main.querySelectorAll(".open-profile").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      state.profile = el.dataset.user;
      state.view = "profile";
      render();
    }),
  );
  main.querySelectorAll(".up-post").forEach((el) =>
    el.addEventListener("click", () => {
      upvote(
        data.posts.find((p) => p.id === Number(el.dataset.id)),
        "post",
      );
    }),
  );
  const more = document.getElementById("more-btn");
  if (more)
    more.addEventListener("click", () => {
      state.page++;
      render();
    });
  document.getElementById("open-submit").addEventListener("click", () => {
    new bootstrap.Modal(document.getElementById("submit-modal")).show();
  });
}
function renderComments(postId, parentId) {
  const list = data.comments.filter((c) => c.postId === postId && c.parentId === parentId);
  if (!list.length) return "";
  return `<ul class="list-unstyled ms-${parentId ? 3 : 0}">${list
    .map(
      (c) => `
      <li id="c${c.id}">
        <div class="small mb-1">
          <button class="btn btn-sm btn-outline-secondary up-comment" data-id="${c.id}">▲</button> ${c.score}
          <a href="#" class="open-profile" data-user="${c.user}">${c.user}</a> ${timeAgo(c.time)}
          <a href="#" class="reply-link" data-id="${c.id}">reply</a>
          <a href="#" class="collapse-link" data-id="${c.id}">[-]</a>
        </div>
        <div class="mb-2 comment-text">${c.text}</div>
        <div class="reply-box d-none mt-2" id="r${c.id}">
          <textarea class="form-control mb-2"></textarea>
          <button class="btn btn-primary btn-sm do-reply" data-id="${c.id}">Post</button>
        </div>
        ${renderComments(postId, c.id)}
      </li>`,
    )
    .join("")}</ul>`;
}
function renderThread() {
  const post = data.posts.find((p) => p.id === state.postId);
  if (!post) return;
  const last = timeAgo(lastUpdated(post));
  let html = `<div class="mb-2"><button id="back-btn" class="btn btn-link p-0">&larr; back</button></div>`;
  html += `<h3>${post.title}</h3>`;
  if (post.url) html += `<div><a href="${post.url}" target="_blank">${post.url}</a></div>`;
  html += `<div class="small text-muted mb-3">by <a href="#" class="open-profile" data-user="${post.user}">${post.user}</a> • ${last} • score ${post.score}</div>`;
  if (post.text) html += `<p>${post.text}</p>`;
  html += `<div id="comments">${renderComments(post.id, null)}</div>`;
  html += `<form id="comment-form" class="mt-3"><textarea class="form-control mb-2" id="comment-text" placeholder="Add a comment"></textarea><button class="btn btn-primary btn-sm">Post</button></form>`;
  main.replaceChildren();
  main.insertAdjacentHTML("afterbegin", html);
  document.getElementById("back-btn").addEventListener("click", () => {
    state.view = "list";
    render();
  });
  main.querySelectorAll(".open-profile").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      state.profile = el.dataset.user;
      state.view = "profile";
      render();
    }),
  );
  main.querySelectorAll(".up-comment").forEach((el) =>
    el.addEventListener("click", () => {
      upvote(
        data.comments.find((c) => c.id === Number(el.dataset.id)),
        "comment",
      );
    }),
  );
  main.querySelectorAll(".reply-link").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const box = document.getElementById(`r${el.dataset.id}`);
      box.classList.toggle("d-none");
    }),
  );
  main.querySelectorAll(".collapse-link").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const li = document.getElementById(`c${el.dataset.id}`);
      const kids = li.querySelector("ul");
      const text = li.querySelector(".comment-text");
      if (kids && !kids.classList.contains("d-none")) {
        kids.classList.add("d-none");
        text.classList.add("d-none");
        el.textContent = "[+]";
      } else {
        if (kids) kids.classList.remove("d-none");
        text.classList.remove("d-none");
        el.textContent = "[-]";
      }
    }),
  );
  main.querySelectorAll(".do-reply").forEach((el) =>
    el.addEventListener("click", () => {
      const box = document.getElementById(`r${el.dataset.id}`);
      const text = box.querySelector("textarea").value;
      addComment(post.id, Number(el.dataset.id), text);
    }),
  );
  document.getElementById("comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = document.getElementById("comment-text").value;
    addComment(post.id, null, t);
  });
}
function renderProfile() {
  const user = data.users[state.profile];
  if (!user) return;
  const posts = data.posts.filter((p) => p.user === state.profile);
  const comments = data.comments.filter((c) => c.user === state.profile);
  let html = `<div class="mb-2"><button id="back-btn" class="btn btn-link p-0">&larr; back</button></div>`;
  html += `<h3>${state.profile}</h3>`;
  html += `<div class="small text-muted mb-3">created ${timeAgo(user.created)} • ${user.karma} karma</div>`;
  html += `<h5>Submissions</h5><ul class="list-group mb-3">${posts
    .map((p) => `<li class="list-group-item"><a href="#" class="open-thread" data-id="${p.id}">${p.title}</a></li>`)
    .join("")}</ul>`;
  html += `<h5>Comments</h5><ul class="list-group">${comments
    .map(
      (c) =>
        `<li class="list-group-item small"><a href="#" class="open-thread" data-id="${c.postId}">${c.text}</a></li>`,
    )
    .join("")}</ul>`;
  main.replaceChildren();
  main.insertAdjacentHTML("afterbegin", html);
  document.getElementById("back-btn").addEventListener("click", () => {
    state.view = "list";
    render();
  });
  main.querySelectorAll(".open-thread").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      state.postId = Number(el.dataset.id);
      state.view = "thread";
      render();
    }),
  );
}
document.getElementById("signin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("signin-user").value.trim();
  const p = document.getElementById("signin-pass").value;
  toggleSpinner(true);
  setTimeout(() => {
    toggleSpinner(false);
    const user = data.users[u];
    if (!user || user.password !== p) return showError("Invalid credentials");
    state.user = u;
    bootstrap.Modal.getInstance(document.getElementById("signin-modal")).hide();
    render();
  }, 300);
});
document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("signup-user").value.trim();
  const p = document.getElementById("signup-pass").value;
  if (data.users[u]) return showError("User exists");
  toggleSpinner(true);
  setTimeout(() => {
    toggleSpinner(false);
    data.users[u] = { password: p, created: Date.now(), karma: 0 };
    state.user = u;
    bootstrap.Modal.getInstance(document.getElementById("signup-modal")).hide();
    render();
  }, 300);
});
document.getElementById("submit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("submit-title").value;
  const url = document.getElementById("submit-url").value;
  const text = document.getElementById("submit-text").value;
  addPost(title, url, text);
  bootstrap.Modal.getInstance(document.getElementById("submit-modal")).hide();
});
document.getElementById("signout-btn").addEventListener("click", () => {
  state.user = null;
  render();
});
document.getElementById("home-link").addEventListener("click", (e) => {
  e.preventDefault();
  state.view = "list";
  render();
});
render();
