
## Prompt (Claude 3.7 Sonnet on Claude.ai)

Write a single page web app that will summarize a GitHub user's recent activity.

Convert the Python code below (which does that) into minimal browser JS ESM code using fetch. Create a BEAUTIFUL Bootstrap 5.3 page that allows the user to enter a GitHub username, a start date (since), an end date (until), a GitHub API token, OpenAI API base URL, OpenAI API key, and a system prompt (defaults to what's below).

On submit, it should run this code in the browser, showing the progress. For each stage, show a progress bar. Also show the link(s) being fetched currently.

Cache fetched URLs in IndexedDB with a TTL of 1 month. Clear cache every time page is visited.

It should STREAM the OpenAI results to the page, converted to Markdown (using marked) using asyncLLM (described below).

It should save all form fields for future usage via saveform (described below).

At the beginning of the page, explain what this app does, and how to use it.

Avoid libraries. Just marked, saveform, asyncllm, Bootstrap.

Style:
- Write SHORT, CONCISE, READABLE code
- Write modular code (iteration, functions, vectorization). No duplication
- Follow existing style. Retain existing comments.
- Use functions, not classes
- Add type hints
- Write single-line docstrings
- Validate early. Use the if-return pattern. Avoid unnecessary else statements
- Avoid try blocks unless the operation is error-prone

HTML/CSS/JS:
- Use ESM: <script type="module">
- No TypeScript. Only JavaScript
- Use MODERN JavaScript. Minimize libraries
- Use hyphenated HTML class/ID names (id="user-id" not id="userId")
- For single line if / for statements, avoid { blocks }
- Use .insertAdjacentHTML / .replaceChildren (or lit-html). Avoid document.createElement
- Use Bootstrap classes for CSS. Avoid custom CSS
- Show errors to the user (beautifully). Avoid console.error()

```python
def fetch_events(user, headers, since):
    url = f"https://api.github.com/users/{user}/events/public"
    events = []
    while url:
        r = requests.get(url, headers=headers)
        page = r.json()
        events.extend(page)
        # stop if all events on this page are before our start
        if all(isoparse(ev["created_at"]) < since for ev in page):
            break
        url = r.links.get("next", {}).get("url")
    return events


def fetch_repo_details(repos, headers):
    """Fetch repository details including description, topics and README."""
    details = {}
    for repo in tqdm(set(repos), desc="Get repos"):
        try:
            info = requests.get(f"https://api.github.com/repos/{repo}", headers=headers).json()
            readme_resp = requests.get(
                f"https://api.github.com/repos/{repo}/readme", headers=headers
            ).json()
            details[repo] = {
                "description": info.get("description", ""),
                "topics": info.get("topics", []),
                "readme": base64.b64decode(readme_resp.get("content", "")).decode(
                    "utf-8", "ignore"
                ),
            }
        except Exception as e:
            tqdm.write(f"Error fetching {repo}: {e}")
    return details


def fetch_github_activity(user, since, until, headers, fields):
    """Fetch and process GitHub events for a user within a date range."""
    evs = fetch_events(user, headers, since)
    activity = []
    repos = set()

    for ev in tqdm(evs, desc="Get events"):
        ts = isoparse(ev["created_at"])
        if not (since <= ts < until):
            continue

        repo = ev["repo"]["name"]
        repos.add(repo)

        if ev["type"] in fields:
            info = {}
            for path in fields[ev["type"]]:
                val = jmespath.search(path, ev)
                info[path] = ", ".join(val) if isinstance(val, list) else val
            activity.append(info)

        if ev["type"] != "PushEvent":
            continue

        for c in ev["payload"]["commits"]:
            try:
                url = f"https://api.github.com/repos/{repo}/commits/{c['sha']}"
                r = requests.get(url, headers=headers)
                r.raise_for_status()
                cj = r.json()
            except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
                tqdm.write(str(e))
                continue
            activity.append(
                {
                    "type": "commit",
                    "repo.name": repo,
                    "created_at": cj["commit"]["author"]["date"],
                    "sha": c["sha"],
                    "message": cj["commit"]["message"],
                    "files": [
                        {
                            "filename": f["filename"],
                            "additions": f["additions"],
                            "deletions": f["deletions"],
                            "changes": f["changes"],
                            "patch": f.get("patch", ""),
                        }
                        for f in cj.get("files", [])
                    ],
                }
            )

    return activity, list(repos)


def get_context(user, since, until)
    activity, repos = fetch_github_activity(
        user,
        since,
        until,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {GITHUB_API_TOKEN}"},
        fields=config["github_fields"],
    )
    context = fetch_repo_details(repos, headers)
    return { "activity": activity, "repos": repos, "context": context }


def get_summary(activity, repos, context):
    payload = {
        "model": "gpt-4.1-mini",
        "input": [
            {"role": "system", "content": config["summary"]},
            {
                "role": "user",
                "content": f"Repository Context:\n{json.dumps(context)}\n\nCommits:\n{json.dumps(activity)}",
            },
        ],
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
    }

    response = requests.post("https://api.openai.com/v1/responses", headers=headers, json=payload)
    result = response.json()
    cost = result["usage"]["input_tokens"] * 0.4 + result["usage"]["output_tokens"] * 1.6
    return result["output"][0]["content"][0]["text"]

context = get_context(user, since, until)
summary = get_summary(context["activity"], context["repos"], context["context"])
```

```toml
summary = '''
You are a personal technical-blog assistant. Your job is to take descriptions of modified Github repositories and a JSON array of commit objects (each with fields: `repo`, `sha`, `author`, `email`, `date`, `message`, and a `files` list) and transform it into a concise, engaging weekly roundup blog post. Follow these rules:

1. **Structure & Organization**
   - **Title & Intro:** Start with a `##` heading (no document title) that summarizes the week in one sentence, followed by a two-sentence intro.
   - **Section per Repo:** For each repository, create a `###` sub-heading that is a Markdown link to the repo URL (e.g. `### [repo](https://github.com/$USER/repo)`).
   - **Overview:** Begin each repo section with one italicized sentence summarizing the changes in the repo in practical terms for someone using the repo.
   - **Bulleted Highlights:** Under each repo, list 3-5 bullets. Each bullet:
     1. Begins with a **bold summary** (one short phrase).
     2. Follows with a concise sentence describing what changed, and how it might be useful to the user. Include inline Markdown links to each relevant commit (e.g. `[75d212c](https://github.com/$USER/repo/commit/75d212c)`), file, or external resource.
     3. If multiple commits relate to the same theme, combine them in one bullet with multiple links.
   - **Suggested Next Steps** Conclude with a `## Suggested Next Steps` section suggesting what the author might want to do next.

2. **Tone & Style**
   - Explain the changes to a layman who might not know what the repo does. Focus on how the change helps practically.
   - Write in short, punchy sentences (≤20 words).
   - Use active voice and simple words (8th-grade level).
   - Inject one light, wry aside per section (e.g., “Yes, you really needed another Fish abbr.”).
   - Don’t mention any personal names or assume prior knowledge of the author.

3. **Formatting & Links**
   - Use Markdown for all headings, links, and bullets.
   - Dates in bullets should be “DD Mon YYYY” format.
   - Link headings to the repo homepages.
   - Link commit SHAs to their GitHub commit pages.
   - If it adds value, link to external docs, issue pages, or related files.

4. **Example Input:**
   ```json
   [
     {
       "repo": "$USER/repo",
       "sha": "33827542abd75497b6ed57efabb77d1422a1160e",
       "date": "2025-04-20T04:26:29Z",
       "message": "REF: .env now uses export which works in fish and bash",
       "files": [ { "filename": "setup.fish" } ]
     },
     …
   ]
   ```

5. **Example Output Snippet:**
   ```markdown
   ## Faster Shells & Smarter APIs

   A week of shell overhauls and API upgrades—streamlining your dev flow and admin controls.

   ### [$USER/repo](https://github.com/$USER/repo)

   Shell startups are faster and the same code works across `fish` _and_ `bash`.

   - **Unified ENV loading:** Swapped custom parser for `source` (see [3382754](https://github.com/$USER/repo/commit/3382754)), so both Fish and Bash behave the same.
   - **Abbrified aliases:** Converted heavy functions to `abbr` (see [90d34b7](https://github.com/$USER/repo/commit/90d34b7)), shaving milliseconds off startup.

   ## Suggested Next Steps
   - Record a before/after demo of your Fish startup time with asciinema.
   ```

When you receive the JSON, produce the full blog post accordingly.
'''


[github_fields]
ForkEvent = ["type", "repo.name", "payload.forkee.full_name", "created_at"]
IssueCommentEvent = ["type", "payload.action", "repo.name", "payload.comment.body", "created_at"]
IssuesEvent = ["type", "payload.action", "repo.name", "payload.issue.title", "payload.issue.body", "created_at"]
PullRequestEvent = ["type", "payload.action", "repo.name", "payload.pull_request.title", "created_at"]
PullRequestReviewEvent = ["type", "payload.review.state", "repo.name", "payload.pull_request.title", "created_at"]
PullRequestReviewCommentEvent = ["type", "repo.name", "payload.comment.body", "created_at"]
PushEvent = ["type", "repo.name", "payload.ref", "payload.commits[*].message", "created_at"]
ReleaseEvent = ["type", "payload.action", "repo.name", "payload.release.tag_name", "short_description_html", "created_at"]
CreateEvent = ["type", "payload.ref_type", "repo.name", "payload.ref", "created_at"]
DeleteEvent = ["type", "payload.ref_type", "repo.name", "payload.ref", "created_at"]
WatchEvent = ["type", "payload.action", "repo.name", "created_at"]
```

## AsyncLLM usage

```js
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";

for await (const { content } of asyncLLM(`${OPENAI_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: "gpt-4.1-nano",
    stream: true, // important
    messages: [...],
  }),
})) {
  // Do what you need with content, which contains the FULL (not incremental) content
}
```

## Saveform usage

```js
  import saveform from "https://cdn.jsdelivr.net/npm/saveform@1";
  saveform("#form-id", { exclude: "" });
```
