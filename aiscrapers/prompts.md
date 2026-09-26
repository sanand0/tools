# Prompts

## Update ChatGPT scraper, 26 Sep 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6-luna --config model_reasoning_effort=high
-->

aiscripers/chatgptscraper.js is no longer working. I think it's because ChatGPT has changed its DOM structure.
Check aiscripers/prompts.md and any other related context. Use agent-browser with CDP localhost:9222 to test on ChatGPT chats. Don't disturb existing windows.
Fix, update tests, verify. Document what happened in aiscrapers/notes.md for future reference.

---

The close icon might have a unicode error - check and fix.

<!-- codex resume 01a0dc20-530f-7bb3-b30a-addb02982c1c --yolo -->

## Update Claude scraper, 21 Sep 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-luna --config model_reasoning_effort=high
-->

aiscrapers/claudescraper.js isn't scraping properly on claude.ai. Fix it. Make sure it works with long Claude Chat / Cowork chats like:

https://claude.ai/cowork/cse_019nJiuf6RDW5Ho8WyG1uSZS
https://claude.ai/cowork/cse_01N2nykRnv9cceipJ9ori6i6
https://claude.ai/chat/6b66230c-0a0c-403b-a957-806e198a2709
https://claude.ai/chat/e269717c-42c4-4f2b-af80-e67520794430

--- <!-- steering -->

Take a look at how the ChatGPT scraper works. Let the USER do the scrolling and monitor the page - don't automate the scrolling.

--- <!-- steering -->

You may have noticed - it seems to be opening a number of other popups as well, which we don't want. Screenshots might help you see this.

---

Include buttons to copy as JSON or just the prompts - exactly like how the ChatGPT scraper does.

---

In both the ChatGPT and Claude scrapers, add a small close button that closes the dialog. Don't auto-close on clicking any button.

---

Make the close button red. Make all the other buttons blue. Reduce the font size a bit (and padding proportionally). Make the close button a bit more square in shape (maybe increase horizontal padding.)

<!-- codex resume 01a0c471-108b-70d1-9b42-5ed9bd502dbc --yolo -->

## Add ChatGPT Prompts scraper, 21 Sep 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-luna --config model_reasoning_effort=high
-->

Minimally modify aiscripers/chatgptscraper.js to include a new button that copies just the user prompts and skips the ChatGPT responses.
The prompts should be separated by `\n\n---\n\n` and there should be no headings.
Instead of the YAML frontmatter, begin with a `<!-- $title: $url ($date) -->\n\n` line, followed by the user prompts separated by `\n\n---\n\n`.
Write tests first, then implement, then run and verify.
Also verify live on chatgpt.com via CDP on localhost:9222, but don't disturb existing tabs. Open a new tab and test.

<!-- codex resume 01a0c465-1f90-7b13-bfbb-1fecfe6ae0e9 --yolo -->

## Add ChatGPT Chats scraper, 18 Sep 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

Add a new scraper in aiscrapers/chatgpt-sidebar-scraper.js that scrapes the ChatGPT sidebar for all the chats and their titles.

The scraper should be able to extract the title of each chat and the corresponding URL from the currently visible set of chats.
If the user scrolls and that reveals more chats, the scraper should be able to extract those as well.

The copy options should be similar to the other bookmarklets: Markdown - which copies a list of `- [Title](link)` lines, and JSON.

Run and test on CDP at localhost:9222 - don't disturb existing ChatGPT windows, feel free to open a new tab and test.
Add test cases. Run and verify.

Update the aiscrapers/ landing page, docs, and any other relevant files.

<!-- codex resume 01a0b37e-1aab-7e32-87d2-cc61765558d3 --yolo -->

## Update and simplify ChatGPT scraper, 27 Aug 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

Let's update the ChatGPT scraper at aiscrapers/chatgptscraper.js.
We want this to be the equivalent of clicking on the "Copy message" button below each user's message and then the "Copy response" below each ChatGPT response and stringing them together one after another under level one sections labeled `# User` and `# ChatGPT`, respectively.
It doesn't have to actually trigger the copy buttons. You can just extract the Markdown from the text - that's fine. Just keep in mind that we want to preserve the formatting. The current code does that OK for the ChatGPT responses (but there may be opportunities to improve) but certainly not for user messages - which are copied as a single line.
We do NOT need to capture the thinking traces by clicking on the sidebar, etc. That slows things down and makes it brittle.
We want to do this by capturing ALL of the messages and responses. Start with what's available in the DOM, but scrolling can reveal more in long conversations. So, like whatsappscraper/ show a button at the top right allowing the user to copy as Markdown or JSON and as the user scrolls, update the number of chat messages. They can copy whichever messages they way.

Test on these ChatGPT conversations (as well as any others) via CDP on localhost:9222 by loading them in new tabs (don't touch existing tabs):
https://chatgpt.com/c/6a8bf567-3b60-83e9-a820-2c2ef190cfe8 (6 messages)
https://chatgpt.com/c/6a8cfe2c-9108-83ee-be70-4572aae9e63e (10+ messages)
https://chatgpt.com/c/6a8e203d-8190-83ec-8607-520741448180 (10+ messages)

Feel free to do this as a complete rewrite if that's what makes it better.
Prefer robust selection strategies, e.g. aria-labels, semantic structure, text content, etc. rather than brittle classes or IDs that look non-semantic and could change.

---

It's worth preserving the frontmatter in the Markdown. Include the timestamps in both if you can retrieve those. Explore opportunities for efficiency an simplification.

<!-- codex resume 01a0403a-ba08-7cc0-9abf-05ac9d3c8c3d --yolo -->

## Capture writing blocks in ChatGPT scraper, 18 Jul 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

The ChatGPT scraper at aiscrapers/chatgptscraper.js does not capture writing blocks.
For example, https://chatgpt.com/c/6a5b09e7-71b0-83ee-8fc7-2198b0396bc2 which is on CDP in localhost:9222 has the text "Before answering, test the framing." and "When reframing, write `Reframed question: …` in one concise sentence..." - these are not captured in the output.
Fix this. (Don't change / close existing tabs in CDP on localhost:9222.)
Keep the edit minimal - or rather, if you find an opportunity to simplify and reduce the lines of code, great, go ahead, but avoid increasing complexity or code size much just for this feature. Ideally, this should happen because of logic that captures the intent better, not an additional fix.

<!-- codex resume 019f73bd-025f-7110-baf4-ef91bbdb50a7 --yolo -->

## Attachments in ChatGPT scraper, 20 Jun 2026

<!--
cd ~/code/tools/
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium
-->

The ChatGPT scraper at aiscrapers/chatgptscraper.js does not capture user attachments.
For example, browsing-history.tsv(1).xz is not captured in https://chatgpt.com/c/6a03c686-c0d0-83ec-96ed-43e03c2b01bb.
Fix this. (Don't change / close existing tabs in CDP on localhost:9222.)

<!-- codex resume 019ee30c-4e9a-74a2-a831-5f25518d6ebb --yolo -->

## Improve ChatGPT scraper, 14 Jun 2026

<!--
cd ~/code/tools/
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium
-->

The ChatGPT scraper at aiscrapers/chatgptscraper.js needs improvements. It's not picking up the thinking - ensure that it picks up all the thinking. For example, on https://chatgpt.com/c/6a2d30d7-a100-83ec-b29b-3f77a37c2a58 we need to extract all the thinking. This should include:

- "I’ll mine the uploaded AQI data..."
- "Inspected and analyzed AQI data ..."
  - The script that begins `import zipfile, os, json, textwrap, pandas as pd, numpy as np, re, glob, pathlib, math, statistics`... with proper Markdown formatting

Run the ChatGPT scraper on 5 ChatGPT chats and test - especially where there are multiple conversations. Make sure the thinking in all the chats is extracted properly.

Use a new tab on CDP (on localhost:9222) rather than disturbing existing tabs.

<!-- codex resume 019ec6f3-5e4d-7ee2-9705-aafdbbfbed3e --yolo -->

## Improve scrapers, 28 May 2026

<!--
cd ~/code/tools/
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium
-->

Modify the AI scrapers so that if the title can't be retrieved from the chat, default to the title from window.title

Run the ChatGPT scraper on the last 15 ChatGPT chats and test. On a few instances, I found "```Bashls -la ..." or some version of this, i.e. "Bash" not "bash", the actual command on the same line, not next line, etc. There may be other errors too. Take a close look. Catalog the errors you find and fix them.

If my intent is unclear, investigate, ask me questions most narrow the direction and define "done" clearly. Skip questioning if/when my needs are clear.

<!-- codex resume 019e6d83-104a-78c0-9191-8f9d665bf751 --yolo -->

## Add AI scrapers, 16 May 2026

<!--
cd ~/code/tools/
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium
-->

Rename the geminiscraper/ directory to aiscrapers/ and change references as required. We will be extending it to cover Claude and ChatGPT as well.

Modify aiscrapers/index.html to be a landing page for all scrapers.

Add a Claude scraper. I have several Claude conversations open via CDP on 9222. Use uvx rodney or agent-browser or playwright in Python to inspect the DOM and find a way to extract the entire conversation as Markdown, including hidden content that might be behind a "show more" as well as the thinking traces that may need multiple, potentially nested, clicks. Implement it in aiscrapers/claudescraper.js and add a button for it on the index.html page.

Add tests to cover the functionality. Validate against a diverse set of Claude pages.

---

How can we make sure that if class / ID names change, this still works? (Aria labels? Semantic structure? Text content?) Incorporate the most robust solution you can find.

Try out on a few more pages.

Then, proceed to open chatgpt.com and create a scraper for the same. Use the same process and principles.

---

On ChatGPT, for example in https://chatgpt.com/c/6a07f23f-0d68-83ec-a366-e71298c9b35b:

We need "Called tool" to read something like this `<details>` section below.

<details>
<summary>Called tool: api_tool - Call Tool</summary>

Request

```
{text: "The output of this plugin was redacted."}
```

Response

The output of this plugin was redacted.

</details>

Another example near the bottom is:

<details>
<summary>Called tool: Local MCP - Bash</summary>

Request

```
{commands: "set -euo pipefail printf 'Now: '... (include full details)}
```

Response

```
{result: "Now: Sat May 16 12:28:03 PM +08 2026 Activities files recent: ... (include full details)}
```

</details>

Also, in the Claude scraper, for example on https://claude.ai/chat/3a953e14-fff1-4f97-b6ff-1955de9bee40, the actual response to the first question, which begins with "The bottleneck shifts because AI ..." is missing. So is the response to the second question: "The deeper move is ...". Fix and test on more chats.

---

In the chat https://claude.ai/chat/1e9e4b7d-8ecb-4d16-9c3a-9d72a602d9cf expand the bash request and results. For example:

Request

```
{
  "query": "bash shell command"
}
```

Response

```
Loaded 2 tools:
  Local MCP (1):
  ...
```

... and similarly the request and response for the Bash commands and so on.

For ChatGPT requests, e.g. https://chatgpt.com/c/6a067ee6-fff0-83ec-ab04-20ebaf0c28ac click on the "Thought for 4m 15s" and similar links to get the thinking traces from the sidebar that it loads afterwards and incorporate them inside a `<details><summary>Thought for 4m 15s</summary>...` section. If there are multiple "Thought for..." sections expand them all - one by one - to extract the information.

Fix and test on a few more chats.

---

On https://claude.ai/chat/9e1f58cd-003a-4160-b753-60498fe0230c I get this output with wrong Markdown formatting:

> [What is llms.txt? How the New AI Standard Works (2026 Guide)
>
> www.bluehost.com](https://www.bluehost.com/blog/what-is-llms-txt/)[LLMS.txt 2026 Guide AI Agents & GEO Optimization

There may be other such errors in other chats. Take a look and fix as required.

<!-- codex resume 019e2fb3-4448-7961-89ca-c7fb18c03340 --yolo -->

## Revise working code

aiscrapers/geminiscraper.js can be pasted into the Gemini browser console to extract Gemini conversations as Markdown.

Modify it to include YAML frontmatter containing `title`, `date`, and `source` fields.

- title: extract from `$(".conversation-title-container .conversation-title").textContent.trim()`
- date: is the current date in ISO format, e.g. `2026-01-11T11:47:53+08:00` -- in local timezone.
- source: is the URL of the Gemini conversation.

Then, create an index.html that displays the script (scrollable, highlighted), allows users to copy to clipboard, and guides them to paste it into the Gemini browser console. Mention that we can't use bookmarklets due to Gemini's restrictions on external scripts.

Explain the purpose of the page and make it elegant and user-friendly, similar to other tools.

Update README.md and config.json accordingly.

Commit as you go.
