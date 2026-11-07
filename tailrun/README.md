# Tailrun

Execute private commands from static web tools over Tailscale, with streaming logs, latest-100 job history, and downloadable artifacts.

Run `python runner.py` on the target computer. The server binds only to `127.0.0.1:8767`. Serve via `tailscale serve --bg --https=8443 8767`, separate from home-directory browsing on port 443. Set `TAILRUN_USERS` to the permitted Tailscale login email(s), separated by commas. The runner denies requests if this variable is unset. Do not use Funnel. No privileged user account.

Endpoints: `GET /run` (latest 100), `POST /run` (JSON argv/cwd/stdin/timeout, streamed NDJSON), `POST /transcribe` (binary file upload; streamed NDJSON), `GET /run?id=ID` (logs; optional `follow=1`), `GET /run?id=ID&meta=1` (status), and `GET /run?id=ID&file=NAME` (inline artifact; add `download=1` to save). Visit `/tailrun/` for tasks, concise job history and logs. Job data goes in `~/.cache/tailrun/jobs/` (override `TAILRUN_STORE`).

Transcribe uploads use `POST /transcribe` with `Content-Type: application/octet-stream`, `X-Tailrun-Request: 1`, and `X-Tailrun-Options` set to URI-encoded JSON: `{"extension":".mp3","filename":"","prompt":""}`. A blank filename defaults to server-local `YYYY-MM-DD hh-mm-ss`. A blank prompt is omitted from the `call` invocation, retaining its default. Files are streamed to temporary job storage (up to 1 GB), converted with the existing Fish `opus` settings, then passed to `~/code/scripts/call`. Results are stored at `~/Dropbox/COPY/transcribe/$filename.{opus,md}` and copied into the job's downloadable artifacts. Requires `ffmpeg`, `uv`, the `call` script, its Gemini credentials, and its configured system-prompt file.

Commands run with the server account's permissions. A Tailscale user who can access this endpoint can run arbitrary commands as that user. Do not share the device, expose its port publicly, or browse untrusted files in the same origin. For browser tools served on a separate origin, set `TAILRUN_ORIGINS` to an explicit comma-separated allowlist (default `https://tools.s-anand.net`).

Tests: `python -m unittest discover -s tests -v`. A developer-only `TAILRUN_DEV=1` bypasses identity checks on loopback, never use in deployment.
