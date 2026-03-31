# WhatsApp Scraper Rewrite, 28 Mar 2026

<!--
cd ~/code/tools
dev.sh
codex --yolo --model gpt-5.4 --config model_reasoning_effort=xhigh
-->

The current whatsappscraper/ script works, sort-of, but has several issues. For example

- The "text" includes the user name at the start like this: "tail-inDennis Varghese" and the timestamps at the end (e.g. "08:3508:35")
- The "time" is null
- We don't need to include isRecalled: false, isSystemMessage: false - only true values are needed and the rest can be omitted
- ... and there may be other such issues.

Here is an example:

```json
  {
    "messageId": "ACFB029C16A9B816DA728EEE3EBA8C39",
    "isSystemMessage": false,
    "isRecalled": false,
    "userId": "6583504500-1518568354",
    "author": "Dennis Varghese",
    "time": null,
    "quoteAuthorPhone": "6590084635",
    "quoteAuthor": "Sadashiv",
    "quoteText": "Jai Shri Ram!\n\nAre foreigner IIMB-ians eligible to take this insurance?",
    "reactions": "🙏",
    "text": "tail-inDennis VargheseI believe an Indian mobile no is a must09:5809:58ic-mood"
  },
```

CDP is available at localhost:9222 and WhatsApp is running and logged in.
`uvx rodney` and playwright are available.
Use what you need, take screenshots, extract from DOM, run JS, etc.

First, create a HTML test set (whatsappscraper/test-messages.html has a bunch from a while ago that you could use as a starting point). Run against that and make sure all output is correct. THEN convert into the bookmarklet structure.

The current code has a number of past layers of "fixes" - some of which may still be relevant, some may be outdated. So think about what's best: start from scratch or build on the existing code. The main thing is to ensure that the output is correct and clean, and that the code is maintainable and understandable.

---

Capture media information, e.g. any INFORMATIVE captions, metadata (e.g. audio length, image dimensions, media type, etc.) where possible.

Scroll up to load more messages and test against ~1,000 messages to ensure it works at scale and doesn't break with older messages.

---

When I scroll, the new messages sometimes take a second or so before they load additional data (e.g. reactions, maybe image captions) and display it. This can be mitigated by the bookmarklet MERGING new data with old data, picking the better / larger version of each, rather than just ignoring new/old messages.

---

Run a blameless post-mortem on this entire conversation to improve future performance.

1. Document the entire process so far (what you did, how, what you found, next steps, etc.).
2. List successes: techniques / approaches you discovered that worked well. Examples: tools, code snippets, prompt structures, planning techniques. Share what change to the environment / prompts will make it easier to repeat these successes in the future.
3. List problems faced: failures, inefficiencies and mis-alignments. E.g. commands that failed or behaved unexpectedly, corrections, more steps than necessary, where you adhered to the letter not spirit, took shortcuts that compromised quality, etc. Dig deep for root causes. Mention the PRACTICAL impact. Suggest pragmatic & safe fixes (if any) to prompts, skills, or environment (e.g. tools, .env) at a root cause level - preferably that resolve **entire classes/patterns of failures**, not just a specific instance.

Create `post-mortem.md` and add `## Post mortem (%d %b %Y)` with today's date.

Commit all files (including the prompts.md I was editing).

<!-- codex resume 'WhatsApp scraper rewrite' -->
