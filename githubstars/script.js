import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { showToast } from "../common/toast.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const formatters = {
  number: new Intl.NumberFormat("en"),
  fullDate: new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }),
  monthYear: new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }),
};

saveform("#repoForm", { exclude: '[type="file"]' });

const extractRepoLinks = (text) => {
  const links = [];
  marked.walkTokens(marked.lexer(text), (token) => {
    if (token.type === "link") {
      const match = token.href.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
      if (match) links.push({ owner: match[1], repo: match[2] });
    }
  });
  return links;
};

const fetchRepoInfo = async (owner, repo, token) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch ${owner}/${repo}`);
  return response.json();
};

const repoTemplate = (repos) => html`
  <table class="table">
    <thead>
      <tr>
        <th>Repository</th>
        <th class="text-end">Stars</th>
        <th class="text-end">Forks</th>
        <th class="text-end">Last Push</th>
      </tr>
    </thead>
    <tbody>
      ${repos.map(
        (repo) => html`
          <tr>
            <td>
              <a href="https://github.com/${repo.full_name}" target="_blank">${repo.full_name}</a>
              ${repo.error && html`<span class="text-danger ms-2">(${repo.error})</span>`}
            </td>
            <td class="text-end">${repo.stargazers_count ? formatters.number.format(repo.stargazers_count) : "-"}</td>
            <td class="text-end">${repo.forks_count ? formatters.number.format(repo.forks_count) : "-"}</td>
            <td class="text-end">${repo.pushed_at ? formatters.fullDate.format(new Date(repo.pushed_at)) : "-"}</td>
          </tr>
        `,
      )}
    </tbody>
  </table>
`;

const replaceText = (text, repoData) =>
  repoData.reduce((text, repo) => {
    if (!repo.error) {
      const pattern = new RegExp(`\\[([^\\]]*?)\\]\\(https:\\/\\/github\\.com\\/${repo.full_name}\\)`, "g");
      const replacement = `[${repo.name} ${formatters.number.format(repo.stargazers_count)} ⭐ ${formatters.monthYear.format(
        new Date(repo.pushed_at),
      )}](https://github.com/${repo.full_name})`;
      return text.replace(pattern, replacement);
    }
    return text;
  }, text);

const tokenInput = document.getElementById("token");
tokenInput.value = localStorage.getItem("github_token") || "";

document.getElementById("repoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("inputText").value;
  const token = tokenInput.value.trim();
  if (token) localStorage.setItem("github_token", token);

  const loading = document.getElementById("loading");
  const resultsDiv = document.getElementById("resultsTable");
  const textarea = document.getElementById("inputText");

  loading.classList.remove("d-none");
  resultsDiv.classList.add("d-none");

  try {
    const repos = extractRepoLinks(text);
    const repoData = await Promise.all(
      repos.map(async (repo) => {
        try {
          return await fetchRepoInfo(repo.owner, repo.repo, token);
        } catch (error) {
          return { ...repo, error: error.message };
        }
      }),
    );

    render(repoTemplate(repoData), resultsDiv);
    resultsDiv.classList.remove("d-none");
    textarea.value = replaceText(
      text,
      repoData.filter((repo) => !repo.error),
    );
  } catch (error) {
    showToast({ title: "Fetch error", body: error.message, color: "bg-danger" });
  } finally {
    loading.classList.add("d-none");
  }
});
