# Scraper notes

## ChatGPT DOM update, 26 Sep 2026

ChatGPT's rendered transcript no longer exposes the older
`data-message-author-role` attributes or `section[data-testid^="conversation-turn-"]`
wrappers. The scraper therefore found no messages on current chats. In the
current DOM, user text is inside `[data-user-message-bubble="true"]` and
assistant Markdown is marked with
`[data-markdown-text-style="assistant-message"]`. User Markdown may also carry
`data-markdown-text-tone="user-message"`. Message IDs live on nearby
`data-chatgpt-search-message-ids` or
`data-chatgpt-selection-message-id` attributes; message timestamps are in a
nearby `time[datetime]` under a `data-content-search-turn-key` container.

The scraper now prefers the old role-marked nodes when present and falls back to
the current user bubble and assistant Markdown markers. It reads the nearby
immutable message ID and timestamp, then uses DOM order while capturing. ChatGPT
still virtualizes long chats, so scroll through older messages to let the
existing capture loop accumulate them. Extraction remains passive and does not
open reasoning controls.

The close button assigns the glyph from the ASCII JavaScript escape `\u00d7`,
avoiding mojibake in bookmarklet injection paths that decode UTF-8 bytes as
Latin-1.
