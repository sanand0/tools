# Tailrun

Execute private commands from static web tools over Tailscale, with streaming logs, latest-100 job history, and downloadable artifacts.

Run `python runner.py` on the target computer. The server binds only to `127.0.0.1:8767`. Serve via `tailscale serve --bg --https=8443 8767`, separate from home-directory browsing on port 443. Set `TAILRUN_USERS` to the permitted Tailscale login email(s), separated by commas. The runner denies requests if this variable is unset. Do not use Funnel. No privileged user account.

Endpoints: `GET /run` (latest 100), `POST /run` (JSON body containing argv/cwd/stdin/timeout, returns streaming NDJSON; requires `X-Tailrun-Request: 1`), `GET /run?id=ID` (NDJSON logs, optional `follow=1`), `GET /run?id=ID&meta=1` (status JSON), and `GET /run?id=ID&file=NAME` (job artifact). Visit `/tailrun/` for dashboard, YouTube MP3, and editor. Job data goes in `~/.cache/tailrun/jobs/` (override `TAILRUN_STORE`).

Commands run with the server account's permissions. A Tailscale user who can access this endpoint can run arbitrary commands as that user. Do not share the device, expose its port publicly, or browse untrusted files in the same origin. For browser tools served on a separate origin, set `TAILRUN_ORIGINS` to an explicit comma-separated allowlist (default `https://tools.s-anand.net`).

Tests: `python -m unittest discover -s tests -v`. A developer-only `TAILRUN_DEV=1` bypasses identity checks on loopback, never use in deployment.
