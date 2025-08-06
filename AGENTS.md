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
- Lint with `npm run lint`; run tests with `npm test`; take full-page screenshots with `npm run screenshot -- ${tool}/ ${tool}/screenshot.webp`
- Never commit generated images. Codex PRs ignore binary files.
- Run a single tool's tests via `npm test -- ${tool}/${tool}.test.js`.
- Prefer `asyncllm` for all LLM calls: `import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2"` then `for await (const { content, error } of asyncLLM(...)) {}` where `content` has the FULL (not incremental) content

Common layout: each tool has `index.html` linking Bootstrap 5, bootstrap-icons@1.13.1, a base64 favicon, a container with headers and forms, and a `<script type="module" src="script.js"></script>` that manipulates the DOM with Bootstrap classes.

## Testing guidelines

- Use [vitest](http://npmjs.com/package/vitest) and [happy-dom](https://www.npmjs.com/package/happy-dom) for front-end testing.
- Avoid `vitest.config.*`; default ESM import works, launch via `"test": "npx -y vitest run"` in `package.json`. Add `happy-dom` as a `devDependency`. Add `npm test` to `prepublishOnly`
- Treat tests as lightweight integration, not unit. Load the full HTML + scripts and verify real DOM mutations; ensures refactors don't silently break UI wiring.
- Share one `Browser` per test suite to cut startup time: `new Browser({console, settings})`. Log browser `console.*` output.
- Mount local HTML. `settings.fetch.virtualServers = [{url:"https://test/", directory: <root>}]`. Use `page.goto("https://test/...")` to load files without a dev-server.
- Create a fresh `page = browser.newPage()` for each test to isolate `window`, `document`, etc.
- `await page.waitUntilComplete()` after `page.goto()` ensures all inline & async scripts executed before assertions.
- Fake timers for deterministic testing.
  - Call `vi.useFakeTimers()` in `beforeAll`, `vi.useRealTimers()` in `afterAll`.
  - Re-bind `window.setTimeout = setTimeout` so app code sees the mocked clock.
  - Drive async paths with `vi.advanceTimersByTime(ms)` instead of `await sleep`.
- Stub external APIs with `vi.fn()` - e.g. `window.fetch = vi.fn(() => Promise.resolve({ok:true,...}))` avoids network and lets you assert payloads.
- Spy on side-effects - `vi.spyOn(console, "error")`, clipboard reads, etc.; always `mockRestore()` afterwards to prevent bleed-through.
- Build specialised browsers (`new Browser({device:{prefersColorScheme:"dark"}})`) to test colour-scheme logic.
- Drive UI through real DOM events. `element.click()` / `dispatchEvent(new window.Event("input",{bubbles:true}))` instead of directly calling handlers; matches user behaviour.
- Add timeouts per test case, e.g. `{ timeout: 10_000 }`, for long-running tests.

### Running tests offline

- Mirror CDN assets under `vendor/` with the same paths used in HTML and scripts.
  - bootstrap@5.3.6 (CSS/JS), bootstrap-icons@1.13.1 (CSS/fonts), bootstrap-alert@1, saveform@1.2, marked@4.3.0, d3-dsv@3/+esm, pages for `news.ycombinator.com` and `www.hntoplinks.com/week`.
- Extend `common/testutils.js` `virtualServers` with `https://cdn.jsdelivr.net/` and `https://llmfoundry.straive.com/` pointing to those mirrors.
