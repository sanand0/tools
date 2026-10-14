# darkmode

## GMail dark mode fix, 14 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=medium
-->

Update darkmode/ for Gmail.
There's a niche case on Gmail where the toolbar for email formatting etc. when composing an email has a white background.
I have that on my screen right now (agent-browser, CDP localhost:9222, see devtools skill, prefer background operations without disturbing tab focus).
This vanishes when I scroll. See if you can fix it. Minimally, elegantly.

<!-- codex resume 01a138d3-1d6d-7be3-8c84-a032c2327c6e --yolo -->

## GMail, 13 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=high
-->

Update darkmode/ to support mails in GMail.

If the URL is mail.google.com and the page is rendering the email body, display that in dark mode.
The list of mails is already in dark mode in my case, so no need to change that just yet.
When I move to a different email, it would be great if the dark mode is applied to the new email body as well - e.g. by changing the style at a level that doesn't change as we navigate emails.
Handle a wide variety of different email bodes by testing out on different kinds of emails - e.g. by searching for different kinds of content or sizes or features, if possible.
Think about patterns of GMail usage and see if the bookmarklet is robust across all of those.

We will add more sites in the future. Extend the bookmarklet in a modular way.

--- <!-- steering -->

Keep in mind that I want the entire screen to be dark - not a white box that contains a dark email.

<!-- codex resume 01a135c9-5138-7003-8398-257ad993853c --yolo -->

## Hacker News, 13 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=medium
-->

Some sites don't have dark mode. Create a bookmarklet at darkmode/ (similar to other bookmarklets in this repo) that will enable a dark mode toggle on the site. That is, every time you run the bookmarklet, it will toggle between dark mode and light mode for the site.

The first site to implement this for is Hacker News: https://news.ycombinator.com/*

Over time, we will add other sites. For now, you may bake the CSS into the bookmarklet. When we scale, if it becomes unwieldy, we can consider loading CSS dynamically.

We want minimal changes to the site, and readability & contrast of all text, hover & other states, dynamic / interactive elements is critical.

---

Reduce the contrast a bit. Keep it consistent with the contrast of popular dark mode themes. This feels like a bit too much contrast - I mean, the white feels a little bit strong.

---

Change the button title to "Dark mode toggle"

---

In tools.json, move it just before Wallhop.

<!-- codex resume 01a135b6-4cd0-72c1-9f39-e7a796e675bf --yolo -->
