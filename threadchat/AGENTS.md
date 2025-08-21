# ThreadChat (Agent Guide)

Client‑only Hacker News–style app. Fake auth + in-memory JS object storage. Reuse repo patterns; keep code short and readable. Prefer a beautiful, polished UI over strict HN mimicry.

Think about features that will increase engagement.

# Coding rules

- Write concise, readable code
- Deduplicate with functions or loops
- Avoid try blocks unless necessary
- Validate early using if-return
- Keep config in files like config.json
- Keep files under ~500 lines
- Use ESM modules, not TypeScript
- Minimize libraries; use modern JavaScript
- Use hyphenated HTML IDs/classes
- Avoid braces for one-line if/for
- Show errors via bootstrap-alert (unicode/, picbook/, googlesuggest/, transcribe/)
- Show a spinner while fetching data
- Insert HTML using insertAdjacentHTML or replaceChildren (googlefit/, unicoder/, llmboundingbox/, picbook/)
- Use Bootstrap classes; minimal custom CSS
- Embed a favicon via data URI (index.html, googlefit/, picbook/, whatsnear/)
- Load script.js as `<script type="module" src="script.js"></script>` (most tools)
- Use saveform to persist forms (githubsummary/, googlefit/, googletasks/, picbook/)
- Use bootstrap-llm-provider for API keys (imagegen/, speakmd/, podcast/, picbook/)
- Stream LLM calls with asyncllm (podcast/, speakmd/, githubsummary/, llmboundingbox/)
- Import utilities from common/ for CSV and errors (googletasks/, json2csv/, excelconvert/, joincsv/)
- Include a navbar and apply add a `bootstrap-dark-theme` (most tools)
- Lint with `npm run lint`; take full-page screenshots with `npm run screenshot -- ${tool}/ ${tool}/screenshot.webp`
- Test with `npm test`. To test a single tool, run `npm test -- ${tool}`
- Never commit generated images. Codex PRs ignore binary files.
- Prefer `asyncllm` for all LLM calls: `import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2"` then `for await (const { content, error } of asyncLLM(...)) {}` where `content` has the FULL (not incremental) content

Common layout: each tool has `index.html` linking Bootstrap 5, bootstrap-icons@1.13.1, a base64 favicon, a container with headers and forms, and a `<script type="module" src="script.js"></script>` that manipulates the DOM with Bootstrap classes.

Sample CDN imports:

- `import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1"`
- `import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2"`

## UI Notes

- Seed with demo data.
- Auth required: users must log in before posting, but not reading
- Auth in modals: navbar shows buttons to open Sign up / Sign in modals. Keep forms compact; primary action prominent; secondary links subtle.
- Beautiful, responsive UI: prefer wrapped buttons and comfortable spacing (use Bootstrap utilities, `btn-group`, `gap-*`). Do not force HN layout if it harms usability.
- Submit: link (title+URL+optional text) and ask (title+text)
- Lists: show score, domain, author, and dynamic comment count; "More" must be based on actual remaining items, not just page size.
- Thread: nested comments with inline reply; allow collapse/expand; show last updated from the latest of post time or latest comment.
- Profile: created, karma, recent submissions and comments; compute all figures live from in-memory data.db

## NO TESTS

Drop tests
