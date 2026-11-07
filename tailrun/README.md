# Tailrun

Execute private commands from static web tools over Tailscale, with streaming logs, latest-100 job history, and downloadable artifacts.

Run `python runner.py` under a normal user account; it binds only to `127.0.0.1:8767` and serves **API requests only**. Tailscale Serve supplies static files directly and reverse-proxies API requests (Windows Admin PowerShell):

```powershell
tailscale serve --bg --https=443 --set-path=/tailrun C:\code\tools\tailrun
tailscale serve --bg --https=443 --set-path=/tailrun/run http://127.0.0.1:8767/run
tailscale serve --bg --https=443 --set-path=/tailrun/upload http://127.0.0.1:8767/transcribe
```

Use `https://plutonium.tail87dc61.ts.net/tailrun/` (the default browser backend is `/tailrun/run`). The static-file directory must never contain credentials or private content, because Tailscale can serve its files. Set `TAILRUN_USERS` to comma-separated permitted Tailscale login emails; with no value the API denies access. The `--bg` Serve routes persist across restarts, but `runner.py` needs a startup task (Windows Task Scheduler, non-elevated S4U). Do not use Funnel.

Public Tailrun API paths are `/tailrun/run` (GET latest 100, POST JSON argv/cwd/stdin/timeout, streamed NDJSON; GET `?id=ID` for logs, `?meta=1` for status, and `?file=NAME` for outputs) and `/tailrun/upload` (POST binary media, streamed NDJSON). These proxy to the runner's internal `/run` and `/transcribe` endpoints. The UI includes tasks, concise job history and logs. Job data goes in `~/.cache/tailrun/jobs/` (override `TAILRUN_STORE`).

Transcribe uploads use `POST /transcribe` with `Content-Type: application/octet-stream`, `X-Tailrun-Request: 1`, and `X-Tailrun-Options` set to URI-encoded JSON: `{"extension":".mp3","filename":"","prompt":""}`. A blank filename defaults to server-local `YYYY-MM-DD hh-mm-ss`. A blank prompt is omitted from the `call` invocation, retaining its default. Files are streamed to temporary job storage (up to 1 GB), converted with the existing Fish `opus` settings, then passed to `~/code/scripts/call`. Results are stored at `~/Dropbox/COPY/transcribe/$filename.{opus,md}` and copied into the job's downloadable artifacts. Requires `ffmpeg`, `uv`, the `call` script, its Gemini credentials, and its configured system-prompt file.

Commands run with the server account's permissions. A Tailscale user who can access this endpoint can run arbitrary commands as that user. Do not share the device, expose its port publicly, or browse untrusted files in the same origin. For browser tools served on a separate origin, set `TAILRUN_ORIGINS` to an explicit comma-separated allowlist (default `https://tools.s-anand.net`).

Tests: `python -m unittest discover -s tests -v`. A developer-only `TAILRUN_DEV=1` bypasses identity checks on loopback, never use in deployment.
