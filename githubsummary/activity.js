// @ts-check

const DEFAULT_MAX_FILES = 12;
const DEFAULT_MAX_PATCH_LINES = 50;

const wildcardToRegExp = (pattern) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

const matchesAnyPattern = (filename, patterns) => patterns.some((pattern) => wildcardToRegExp(pattern).test(filename));

const truncatePatch = (patch, maxLines = DEFAULT_MAX_PATCH_LINES) => {
  if (!patch) return "";
  const lines = patch.split("\n");
  if (lines.length <= maxLines) return patch;

  const keepEach = Math.floor(maxLines / 2);
  const skipped = lines.length - maxLines;
  const start = lines.slice(0, keepEach);
  const end = lines.slice(-keepEach);
  return [...start, `\n... [${skipped} lines truncated] ...\n`, ...end].join("\n");
};

const isBinaryPatch = (patch) => {
  if (!patch || patch.length < 200) return false;
  if (patch.includes("////") || patch.includes("AAAA")) return true;
  return patch
    .split("\n")
    .slice(0, 10)
    .some((line) => line.length > 500);
};

const summarizeFiles = (files, skipFiles, maxFiles = DEFAULT_MAX_FILES, maxPatchLines = DEFAULT_MAX_PATCH_LINES) => {
  if (!files?.length) return [];

  const fileImportance = (file) => {
    const name = file.filename || "";
    if (/\.(py|js|ts|go|rs|java|c|cpp)$/.test(name)) return [0, -file.changes];
    if (/\.(md|txt|rst)$/.test(name)) return [1, -file.changes];
    if (/\.(json|yaml|toml|xml)$/.test(name)) return [2, -file.changes];
    return [3, -file.changes];
  };

  const sortedFiles = [...files].sort((a, b) => {
    const [pa, ca] = fileImportance(a);
    const [pb, cb] = fileImportance(b);
    return pa === pb ? ca - cb : pa - pb;
  });

  const result = [];
  for (const file of sortedFiles.slice(0, maxFiles)) {
    const rawPatch = file.patch || "";
    let patch = truncatePatch(rawPatch, maxPatchLines);
    if (matchesAnyPattern(file.filename, skipFiles)) patch = "...";
    if (isBinaryPatch(rawPatch)) patch = "[binary/generated content]";

    result.push({
      filename: file.filename,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch,
    });
  }

  if (files.length > maxFiles) {
    const remaining = files.slice(maxFiles);
    result.push({
      filename: `... and ${remaining.length} more files`,
      additions: remaining.reduce((acc, f) => acc + (f.additions || 0), 0),
      deletions: remaining.reduce((acc, f) => acc + (f.deletions || 0), 0),
      changes: remaining.reduce((acc, f) => acc + (f.changes || 0), 0),
      patch: "",
    });
  }

  return result;
};

const parseLinkHeader = (linkHeader) => {
  if (!linkHeader) return null;
  return linkHeader
    .split(",")
    .map((part) => part.trim())
    .map((part) => part.split(";"))
    .map(([url, rel]) => [url.replace(/[<>]/g, ""), rel?.trim()])
    .find(([, rel]) => rel === 'rel="next"')?.[0];
};

const toIsoDate = (value) => (typeof value === "string" ? `${value}T00:00:00Z` : value.toISOString());

export const createActivityClient = ({ fetchImpl = fetch, onRequest } = {}) => {
  const request = async (method, url, { headers = {}, body, params, allowStatuses = [] } = {}) => {
    const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;
    onRequest?.(fullUrl);
    const response = await fetchImpl(fullUrl, { method, headers, body });
    if (!response.ok && !allowStatuses.includes(response.status)) {
      const text = await response.text();
      const snippet = text.slice(0, 500);
      throw new Error(`HTTP ${response.status} for ${fullUrl}: ${snippet || response.statusText}`);
    }
    return response;
  };

  const graphqlQuery = async (query, variables, headers) => {
    const response = await request("POST", "https://api.github.com/graphql", {
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const result = await response.json();
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    return result.data;
  };

  const fetchContributedRepos = async (user, since, until, headers) => {
    const query = `
      query($user: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $user) {
          contributionsCollection(from: $from, to: $to) {
            commitContributionsByRepository(maxRepositories: 100) {
              repository { nameWithOwner }
              contributions { totalCount }
            }
          }
        }
      }
    `;
    const variables = {
      user,
      from: toIsoDate(since),
      to: toIsoDate(until),
    };
    const data = await graphqlQuery(query, variables, headers);
    return (
      data?.user?.contributionsCollection?.commitContributionsByRepository?.map(({ repository, contributions }) => ({
        name: repository.nameWithOwner,
        commitCount: contributions.totalCount,
      })) || []
    );
  };

  const fetchRepoCommits = async (repo, since, until, headers) => {
    const params = {
      since: toIsoDate(since),
      until: toIsoDate(until),
      per_page: 100,
    };
    const commits = [];
    let nextUrl = `https://api.github.com/repos/${repo}/commits`;
    while (nextUrl) {
      const response = await request("GET", nextUrl, {
        headers,
        params,
        allowStatuses: [409],
      });
      params.since = undefined;
      params.until = undefined;
      if (response.status === 409) break; // Empty repository

      const page = await response.json();
      commits.push(...page);
      nextUrl = parseLinkHeader(response.headers.get("link"));
    }
    return commits;
  };

  const fetchCommitDetails = async (repo, sha, headers) => {
    const url = `https://api.github.com/repos/${repo}/commits/${sha}`;
    const response = await request("GET", url, { headers });
    return response.json();
  };

  const fetchGitHubActivity = async (
    user,
    since,
    until,
    headers,
    { skipRepos = [], skipFiles = [], onProgress, onCommit } = {},
  ) => {
    const activity = [];
    const seenCommits = new Set();

    const repos = await fetchContributedRepos(user, since, until, headers);
    const repoNames = repos.map((repo) => repo.name).filter((name) => !skipRepos.includes(name));
    onProgress?.({ stage: "repos", total: repoNames.length });
    onProgress?.({ stage: "commits", current: 0, total: 1 });

    let processedRepos = 0;
    for (const repo of repoNames) {
      const commits = await fetchRepoCommits(repo, since, until, headers);
      onProgress?.({
        stage: "commits",
        current: 0,
        total: Math.max(commits.length, 1),
        repo,
      });

      let processedCommits = 0;
      for (const commitInfo of commits) {
        const sha = commitInfo.sha;
        if (seenCommits.has(sha)) continue;
        seenCommits.add(sha);

        const authorLogin = commitInfo.author?.login;
        const committerLogin = commitInfo.committer?.login;
        if (authorLogin !== user && committerLogin !== user) continue;

        const commitDetails = await fetchCommitDetails(repo, sha, headers);
        activity.push({
          type: "commit",
          "repo.name": repo,
          created_at: commitDetails.commit?.author?.date,
          sha,
          message: commitDetails.commit?.message,
          url: commitDetails.html_url,
          files: summarizeFiles(commitDetails.files || [], skipFiles),
        });

        onCommit?.([...activity]);
        processedCommits += 1;
        onProgress?.({
          stage: "commits",
          current: processedCommits,
          total: Math.max(commits.length, 1),
          repo,
          url: commitDetails.html_url,
        });
      }

      processedRepos += 1;
      onProgress?.({
        stage: "repos",
        current: processedRepos,
        total: Math.max(repoNames.length, 1),
        repo,
      });
    }

    return { activity, repos: repoNames };
  };

  return {
    fetchGitHubActivity,
    fetchContributedRepos,
    fetchRepoCommits,
    summarizeFiles,
    truncatePatch,
    isBinaryPatch,
  };
};
