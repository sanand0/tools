# ThreadChat (Agent Guide)

Client‑only Hacker News–style app. Fake auth + storage via IndexedDB. Reuse repo patterns; keep code short and readable. Prefer a beautiful, polished UI over strict HN mimicry.

## Must Reuse

See other tools for reference:

- UI: Bootstrap 5 + bootstrap‑icons, data‑URI favicon, apply `bootstrap-dark-theme` on a top‑level wrapper
- UX: show spinners during async work; errors via `bootstrapAlert({ title, body, color })`
- DOM: `insertAdjacentHTML` / `replaceChildren` (avoid `createElement`)
- Forms: `saveform` for persistence

Sample CDN imports:

- `import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1"`
- `import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2"`

## Files

- `index.html` — shell with navbar (Top, New, Ask, Show, Submit) and auth area
- `script.js` — startup, hash‑routing, event wiring, IndexedDB open/CRUD/query helpers, sign‑up/in/out, session helpers, small HTML template helpers
- `threadchat.test.js` — integration tests (happy‑dom)

## UI Notes

- Seed IndexedDB with demo data.
- Auth required: users must log in before posting, but not reading
- Auth in modals: navbar shows buttons to open Sign up / Sign in modals. Keep forms compact; primary action prominent; secondary links subtle.
- Beautiful, responsive UI: prefer wrapped buttons and comfortable spacing (use Bootstrap utilities, `btn-group`, `gap-*`). Do not force HN layout if it harms usability.
- Submit: link (title+URL+optional text) and ask (title+text)
- Lists: show score, domain, author, and dynamic comment count; "More" must be based on actual remaining items, not just page size.
- Thread: nested comments with inline reply; allow collapse/expand; show last updated from the latest of post time or latest comment.
- Profile: created, karma, recent submissions and comments; compute all figures live from IndexedDB.

## Tests (vitest + happy‑dom)

- Use `common/testutils.js` (one Browser per suite, new page per test)
- Fake timers; rebind `window.setTimeout = setTimeout`
- Cover: auth flow via modals, submit + vote (dedupe vote), nested replies, karma on profile; dynamic comment counts and last‑updated calculation; DB reset button wipes and re‑seeds.
- Run linting
- Run tests and ensure that they pass

## Pitfalls to Avoid

- No classes, no `document.createElement`, no `console.error` (show alerts)
- Don’t store plaintext passwords; use Web Crypto SHA‑256 hash (demo‑only)
- Enforce unique usernames; enforce one‑vote per item per user
- Always create indexes in `onupgradeneeded`; memoize `openDB()`
- Keep files < ~500 lines; validate early with if‑return; use hyphenated IDs/classes
- Do not hardcode counts or timestamps; compute comment counts and last updated from live queries each render
