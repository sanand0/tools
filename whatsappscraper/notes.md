# WhatsApp Web DOM Notes

## 28 Mar 2026

Observed structure used by the March 2026 scraper rewrite.

- Message rows were found under `#main [role="row"]`.
- Each message row contained a descendant with `data-id`.
- `data-id` used a packed format like:
  - `true_<chat-id>@..._<message-id>`
  - `false_<chat-id>@..._<message-id>`
- The scraper derived three fields from that single attribute:
  - `messageId`
  - `userId` / chat id
  - `isOutgoing`
- `data-pre-plain-text` was present on the visible message bubble and looked like:
  - `[13:52, 22/03/2026] +65 9000 0001: `
  - `[8:05 pm, 14/12/2025] Jordan Poe: `
- Human-visible message text was still available via:
  - `[data-testid="selectable-text"]`
  - `.selectable-text`
- Other useful structures:
  - `.message-in` / `.message-out`
  - `[aria-label="Quoted message" i]`
  - `[data-icon="recalled"]`
  - reaction summaries in `aria-label`

Implication:

- The old parser could treat row identity as a single parsing problem because one attribute carried message id, chat id, and direction together.

## 19 Apr 2026

Observed structure in the live WhatsApp Web tab when the scraper started returning `Copy 0 messages`.

- Message rows are still found under `#main [role="row"]`.
- Visible message rows still have a descendant with `data-id`.
- `data-id` now looks like a bare message id, for example:
  - `3A4689CE2A81856D4BB0`
  - `ACED689BB5C3115D3DD361F3520F9ECE`
- `data-pre-plain-text` is still present and still useful for timestamp and sender parsing.
- Human-visible text is still available via:
  - `[data-testid="selectable-text"]`
  - `.selectable-text`
- Direction still appears in row structure:
  - incoming rows use `.message-in`
  - outgoing rows use `.message-out`

What changed:

- The packed `data-id` contract changed.
- `data-id` no longer cleanly exposes:
  - chat id / `userId`
  - outgoing direction
- The old regex parser therefore rejected every visible message row.
- Because row parsing failed at the identity step, the bookmarklet showed `Copy 0 messages` even though the rest of the message DOM was still present.

What did **not** change:

- `#main [role="row"]` remained valid.
- `data-pre-plain-text` remained valid.
- selectable-text remained valid.
- quote / reaction / recalled structures still appeared to exist.

Current parsing strategy after the fix:

- Treat row identity and chat identity as separate concerns.
- Parse `messageId` from:
  - old packed `data-id`, or
  - new bare-message-id `data-id`
- Derive `isOutgoing` from:
  - old packed `data-id`, or
  - `.message-out`
- Resolve `userId` separately as best-effort.
  - If WhatsApp exposes a stable current-chat id later, it should be wired into `resolveCurrentChatId()`.
  - If not, `userId` remains optional and must not block message capture.

## Quick Debug Checklist

When the scraper breaks again, check these first in the live tab:

1. Count `#main [role="row"]`.
2. Count `#main [data-id]`.
3. Inspect a few raw `data-id` values.
4. Check whether `data-pre-plain-text` still exists on visible rows.
5. Check whether outgoing rows still use `.message-out`.
6. If rows exist but parsed messages are `0`, the row identity parser is the first suspect.
