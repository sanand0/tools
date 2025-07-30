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
- Import utilities from common/ for CSV and errors (googletasks/, json2csv/, excel2jsonl/, joincsv/)
- Include a navbar and apply add a `bootstrap-dark-theme` (most tools)
- Lint with `npm run lint`; run tests with `npm test`; take full-page screenshots with `npm run screenshot -- tool/ tool/screenshot.webp`
- Never commit generated images. Codex PRs ignore binary files.
- Run a single tool's tests via `npm test -- tool/test.js`.
- Prefer `asyncllm` for all LLM calls: `import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2"` then `for await (const { content, error } of asyncLLM(...)) {}` where `content` has the FULL (not incremental) content

Common layout: each tool has `index.html` linking Bootstrap 5, bootstrap-icons@1.13.1, a base64 favicon, a container with headers and forms, and a `<script type="module" src="script.js"></script>` that manipulates the DOM with Bootstrap classes.
