import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const main = document.getElementById("main");
const loading = document.getElementById("loading");
const navAuth = document.getElementById("nav-auth");
const alert = bootstrapAlert(document.getElementById("error-container"));

let db = { users: {}, posts: [] };
let current = localStorage.getItem("threadchat-user") || "";

const timeAgo = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const countComments = (cs) => cs.reduce((n, c) => n + 1 + countComments(c.comments || []), 0);

const lastUpdated = (post) => {
  const times = [post.time];
  const walk = (cs) =>
    cs.forEach((c) => {
      times.push(c.time);
      walk(c.comments || []);
    });
  walk(post.comments || []);
  return Math.max(...times);
};

const setUser = (name) => {
  current = name;
  if (name) localStorage.setItem("threadchat-user", name);
  else localStorage.removeItem("threadchat-user");
  renderNav();
  renderView();
};

const renderNav = () => {
  navAuth.replaceChildren();
  if (current) {
    navAuth.insertAdjacentHTML(
      "beforeend",
      `<span class="navbar-text">Hi, ${current}</span><button id="sign-out-btn" class="btn btn-outline-secondary btn-sm ms-2">Sign out</button><button id="submit-btn" class="btn btn-primary btn-sm ms-2">Submit</button>`,
    );
    document.getElementById("sign-out-btn").onclick = () => setUser("");
    document.getElementById("submit-btn").onclick = () => new bootstrap.Modal("#submit-modal").show();
  } else {
    navAuth.insertAdjacentHTML(
      "beforeend",
      `<button id="sign-up-btn" class="btn btn-primary btn-sm me-2">Sign up</button><button id="sign-in-btn" class="btn btn-outline-secondary btn-sm">Sign in</button>`,
    );
    document.getElementById("sign-up-btn").onclick = () => new bootstrap.Modal("#sign-up-modal").show();
    document.getElementById("sign-in-btn").onclick = () => new bootstrap.Modal("#sign-in-modal").show();
  }
};

const fetchData = () => {
  loading.classList.remove("d-none");
  fetch("data.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => {
      db = j;
      renderView();
    })
    .catch((e) => alert(e))
    .finally(() => loading.classList.add("d-none"));
};

window.addEventListener("hashchange", renderView);

const renderView = () => {
  const h = location.hash;
  if (h.startsWith("#post-")) return renderPost(Number(h.slice(6)));
  if (h.startsWith("#user-")) return renderProfile(h.slice(6));
  renderPosts();
};

const renderPosts = (page = 0, size = 5) => {
  const start = page * size;
  const posts = [...db.posts].sort((a, b) => b.score - a.score || b.time - a.time);
  const slice = posts.slice(start, start + size);
  const remain = posts.length - start - slice.length;
  const items = slice
    .map(
      (p) =>
        `<li class="list-group-item d-flex"><div class="me-2 text-center"><button data-id="${p.id}" class="btn btn-sm btn-link text-decoration-none vote-btn">▲</button><div class="small">${p.score}</div></div><div><a href="#post-${p.id}" class="fw-bold">${p.title}</a>${
          p.url ? ` <small class="text-secondary">(${new URL(p.url).hostname.replace("www.", "")})</small>` : ""
        }<div class="small text-secondary">${p.score} points by <a href="#user-${p.author}">${p.author}</a> ${timeAgo(lastUpdated(p))} ago | ${countComments(p.comments)} comments</div></div></li>`,
    )
    .join("");
  main.replaceChildren();
  main.insertAdjacentHTML("beforeend", `<ol class="list-group list-group-numbered mb-3">${items}</ol>`);
  slice.forEach((p) => (document.querySelector(`[data-id="${p.id}"]`).onclick = () => votePost(p.id)));
  if (remain > 0)
    main.insertAdjacentHTML("beforeend", `<button id="more-btn" class="btn btn-outline-secondary">More</button>`);
  const btn = document.getElementById("more-btn");
  if (btn) btn.onclick = () => renderPosts(page + 1, size);
};

const votePost = (id) => {
  if (!current) return alert("Sign in to vote");
  const user = db.users[current];
  user.votedPosts = [...(user.votedPosts || [])];
  if (user.votedPosts.includes(id)) return;
  user.votedPosts.push(id);
  const post = db.posts.find((p) => p.id === id);
  post.score++;
  renderView();
};

const renderPost = (id) => {
  const post = db.posts.find((p) => p.id === id);
  if (!post) return;
  const domain = post.url
    ? `<small class="text-secondary">(${new URL(post.url).hostname.replace("www.", "")})</small>`
    : "";
  main.innerHTML = `<div class="mb-3"><h2><a href="${post.url || "#"}" ${
    post.url ? 'target="_blank"' : ""
  }>${post.title}</a> ${domain}</h2><div class="small text-secondary">${post.score} points by <a href="#user-${post.author}">${post.author}</a> ${timeAgo(
    lastUpdated(post),
  )} ago</div><div class="mt-3">${post.text || ""}</div></div><div id="comments"></div>`;
  renderComments(post.comments, document.getElementById("comments"), post.id);
};

const renderComments = (comments, container, postId) => {
  const list = comments
    .map(
      (c) =>
        `<li class="mb-2" id="comment-${c.id}"><div><button data-cid="${c.id}" class="btn btn-sm btn-link text-decoration-none vote-btn">▲</button> ${c.score} by <a href="#user-${c.author}">${c.author}</a> ${timeAgo(
          c.time,
        )} ago | <a href="#" data-reply="${c.id}">reply</a> <a href="#" data-toggle="${c.id}" class="ms-2">[-]</a></div><div class="ms-4 comment-body">${c.text}</div><ul class="ms-4" id="replies-${c.id}"></ul></li>`,
    )
    .join("");
  container.innerHTML = `<ul class="list-unstyled">${list}</ul><div id="comment-form"></div>`;
  comments.forEach((c) => {
    document.querySelector(`[data-cid="${c.id}"]`).onclick = () => voteComment(postId, c.id);
    document.querySelector(`[data-reply="${c.id}"]`).onclick = (e) => {
      e.preventDefault();
      showReplyForm(postId, c.id);
    };
    document.querySelector(`[data-toggle="${c.id}"]`).onclick = (e) => {
      e.preventDefault();
      toggleComment(c.id);
    };
    renderComments(c.comments, document.getElementById(`replies-${c.id}`), postId);
  });
  showCommentForm(postId);
};

const toggleComment = (id) => {
  const body = document.querySelector(`#comment-${id} .comment-body`);
  const replies = document.getElementById(`replies-${id}`);
  const link = document.querySelector(`[data-toggle="${id}"]`);
  const hidden = body.classList.toggle("d-none");
  replies.classList.toggle("d-none");
  link.textContent = hidden ? "[+]" : "[-]";
};

const showCommentForm = (postId) => {
  const form = document.getElementById("comment-form");
  if (!current) {
    form.innerHTML = '<p><a href="#" id="login-to-comment">Sign in</a> to comment.</p>';
    document.getElementById("login-to-comment").onclick = (e) => {
      e.preventDefault();
      new bootstrap.Modal("#sign-in-modal").show();
    };
    return;
  }
  form.innerHTML = `<textarea id="comment-text" class="form-control mb-2" rows="3"></textarea><button id="comment-submit" class="btn btn-primary btn-sm">Add Comment</button>`;
  document.getElementById("comment-submit").onclick = () => {
    const text = document.getElementById("comment-text").value.trim();
    if (!text) return;
    const comment = { id: Date.now(), author: current, text, time: Date.now(), score: 1, comments: [] };
    const post = db.posts.find((p) => p.id === postId);
    post.comments.push(comment);
    renderPost(postId);
  };
};

const showReplyForm = (postId, parentId) => {
  const el = document.getElementById(`replies-${parentId}`);
  if (!current) return alert("Sign in to reply");
  if (document.getElementById(`reply-text-${parentId}`)) return;
  el.insertAdjacentHTML(
    "afterbegin",
    `<li><textarea id="reply-text-${parentId}" class="form-control mb-2" rows="3"></textarea><button id="reply-btn-${parentId}" class="btn btn-primary btn-sm">Reply</button></li>`,
  );
  document.getElementById(`reply-btn-${parentId}`).onclick = () => {
    const text = document.getElementById(`reply-text-${parentId}`).value.trim();
    if (!text) return;
    const comment = { id: Date.now(), author: current, text, time: Date.now(), score: 1, comments: [] };
    const post = db.posts.find((p) => p.id === postId);
    const add = (cs) => {
      for (const c of cs) {
        if (c.id === parentId) return c.comments.push(comment);
        add(c.comments);
      }
    };
    add(post.comments);
    renderPost(postId);
  };
};

const voteComment = (postId, cid) => {
  if (!current) return alert("Sign in to vote");
  const user = db.users[current];
  user.votedComments = [...(user.votedComments || [])];
  if (user.votedComments.includes(cid)) return;
  user.votedComments.push(cid);
  const post = db.posts.find((p) => p.id === postId);
  const find = (cs) => {
    for (const c of cs) {
      if (c.id === cid) return c.score++;
      find(c.comments);
    }
  };
  find(post.comments);
  renderPost(postId);
};

const renderProfile = (name) => {
  const user = db.users[name];
  if (!user) return;
  const posts = db.posts.filter((p) => p.author === name);
  const comments = [];
  const collect = (cs) => {
    for (const c of cs) {
      if (c.author === name) comments.push(c);
      collect(c.comments);
    }
  };
  db.posts.forEach((p) => collect(p.comments));
  const karma = posts.reduce((n, p) => n + p.score, 0) + comments.reduce((n, c) => n + c.score, 0);
  main.innerHTML = `<h2>${name}</h2><p class="text-secondary">joined ${timeAgo(user.created)} ago · ${karma} karma</p><h3 class="h5">Submissions</h3><ul>${posts
    .map((p) => `<li><a href="#post-${p.id}">${p.title}</a></li>`)
    .join("")}</ul><h3 class="h5">Comments</h3><ul>${comments.map((c) => `<li>${c.text}</li>`).join("")}</ul>`;
};

document.getElementById("sign-in-form").onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("sign-in-name").value.trim();
  const pass = document.getElementById("sign-in-pass").value;
  const user = db.users[name];
  if (!user || user.password !== pass) return alert("Invalid credentials");
  bootstrap.Modal.getInstance(document.getElementById("sign-in-modal")).hide();
  setUser(name);
};

document.getElementById("sign-up-form").onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("sign-up-name").value.trim();
  const pass = document.getElementById("sign-up-pass").value;
  if (db.users[name]) return alert("User exists");
  db.users[name] = { password: pass, created: Date.now() };
  bootstrap.Modal.getInstance(document.getElementById("sign-up-modal")).hide();
  setUser(name);
};

document.getElementById("submit-form").onsubmit = (e) => {
  e.preventDefault();
  const type = document.querySelector("input[name='post-type']:checked").value;
  const title = document.getElementById("post-title").value.trim();
  const url = document.getElementById("post-url").value.trim();
  const text = document.getElementById("post-text").value.trim();
  if (!title || (type === "link" && !url)) return alert("Missing fields");
  const id = Date.now();
  db.posts.unshift({
    id,
    title,
    url: type === "link" ? url : "",
    text: type === "ask" ? text : "",
    author: current,
    time: Date.now(),
    score: 1,
    comments: [],
  });
  bootstrap.Modal.getInstance(document.getElementById("submit-modal")).hide();
  renderView();
};

fetchData();
renderNav();
