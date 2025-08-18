import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const config = await fetch("./config.json")
  .then((r) => r.json())
  .catch(() => ({ maxResults: 1000 }));

const form = document.getElementById("search-form");
const sourceSelect = document.getElementById("source-select");
const maxResultsInput = document.getElementById("max-results");
const alerts = document.getElementById("alerts");
const spinner = document.getElementById("spinner");
const results = document.getElementById("results");
maxResultsInput.value = config.maxResults;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alerts.replaceChildren();
  results.replaceChildren();
  spinner.classList.remove("d-none");

  const base = sourceSelect.value;
  const max = Number(maxResultsInput.value) || config.maxResults;
  if (!base) {
    spinner.classList.add("d-none");
    return bootstrapAlert({ title: "Missing source", body: "Select a source", color: "danger" });
  }

  const users = new Map();
  const repoStars = new Map();
  const perPage = 100;
  const pages = Math.ceil(max / perPage);

  for (let page = 1; page <= pages; page++) {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(base + " is:pr is:merged")}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      bootstrapAlert({ title: "Fetch error", body: text, color: "danger" });
      break;
    }
    const data = await res.json();
    for (const item of data.items) {
      const login = item.user.login;
      const repo = item.repository_url.split("/").slice(-2).join("/");
      const user = users.get(login) || { prs: 0, repos: new Map() };
      user.prs++;
      user.repos.set(repo, (user.repos.get(repo) || 0) + 1);
      users.set(login, user);
      if (!repoStars.has(repo)) {
        const repoRes = await fetch(item.repository_url);
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          repoStars.set(repo, repoData.stargazers_count || 0);
        } else repoStars.set(repo, 0);
      }
    }
    renderTable(users, repoStars);
    if (data.items.length < perPage) break;
  }
  spinner.classList.add("d-none");
});

function renderTable(users, repoStars) {
  const rows = [...users.entries()].map(([login, user]) => {
    const repos = [...user.repos.entries()].map(([repo, count]) => ({
      repo,
      count,
      stars: repoStars.get(repo) || 0,
      score: Math.log2(repoStars.get(repo) || 1) * Math.log2(1 + count),
    }));
    const score = repos.reduce((s, r) => s + r.score, 0);
    const topRepos = repos.sort((a, b) => b.stars - a.stars).slice(0, 5);
    return { login, prs: user.prs, repoCount: user.repos.size, score, topRepos };
  });

  const body = rows.map(
    (r) =>
      html`<tr>
        <td><a href="https://github.com/${r.login}" target="_blank">${r.login}</a></td>
        <td>${r.prs}</td>
        <td>${r.repoCount}</td>
        <td>${r.score.toFixed(2)}</td>
        <td>
          ${r.topRepos.map(
            (repo, i) =>
              html`${i ? ", " : ""}<a
                  href="https://github.com/${repo.repo}/pulls?q=is:pr+author:${r.login}"
                  target="_blank"
                  >${repo.repo}</a
                >`,
          )}
        </td>
      </tr>`,
  );
  const table = html`<table class="table table-striped">
    <thead>
      <tr>
        <th>User</th>
        <th>PRs</th>
        <th>Repos</th>
        <th>Score</th>
        <th>Repos</th>
      </tr>
    </thead>
    <tbody>
      ${body}
    </tbody>
  </table>`;
  render(table, results);
}
