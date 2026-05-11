# Prompts

## Page scraper, 11 May 2026

<!--

cd /home/sanand/code/tools
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium

-->

We will be adding a LinkedIn Profile Scraper to linkedinscraper/ that can scrape all profile information from a LinkedIn profile page.

This will sit alongside the invite scraper.
First, rename the label for the invite scraper to "LinkedIn Invite Scraper" instead of just "Invite Scraper" for clarity.

Some content automatically loads when we scroll. So ensure that the scraper scrolls through the entire page to load all content before extracting.

Create a button (like the invite scraper) to copy the information as AI-agent friendly Markdown (not JSON). The bulk of the information may be available in the DOM and could be used as-is, perhaps just by ignoring some irrelevant sections, tags, etc. Keep it simple and robust.

There are several LinkedIn profiles open on CDP 9222 (use agent-browser, rodney or uvx playwright). Some are scrolled to the end, some are not. Test on a good sample. Save the output in linkedinscraper/sample/\*.md for review. Then I'll guide you.

---

Read through the output yourself. Is this what will be meaningful to a human or an AI agent to understand the profile of a person?
For example, will any of the links be at all useful?
Will this structure be confusing or clear? Research what modern LLMs and AI agents can read well - and their capabilities are growing.
Use `copilot` CLI to check with a few other smart models that copilot supports to see what they think of the output structuring, e.g. testing if they are able to infer correctly and if they believe a different structure would help them.
Keep in mind the ease of implementation. Just a simple copy-paste of visible text might actually work, too.
Think about the best way to structure the experiments and run them.
Consolidate and share their feedback with me, prioritized, on how to structure the output better - factoring in ease + impact.
Then I'll suggest what to do.

---

Go ahead with your recommendation and show me the sample output. Also, there's more material on Amit Gupta. Write the scraper to ensure that it scrolls till the end, awaits the information, then copies.

---

How can we make all sections more human-readable the way the profile summary is structured, keeping the code small and light, as well as robust for new features / sections / etc.?
Priorities: Don't miss anything > format well > keep it simple.

Using these principles, create the bookmarklet, add it to linkedinscraper/ as profile scraper.

Include test cases. Run and test on actual profiles.

<!-- codex resume 019e1522-11d1-7ef3-b144-0b08d4d6e5e6 --yolo -->

## Invite scraper, 11 May 2026

<!--

cd /home/sanand/code/tools
dev.sh
codex --yolo --model gpt-5.5 --config model_reasoning_effort=medium

-->

I intend for linkedinscraper/ to be a collection of bookmarklets to scrape different sections of LinkedIn.

First, build a LinkedIn invite scraper bookmarklet that scrapes https://www.linkedin.com/mynetwork/invitation-manager/received/ and lets me copy the data as JSON.

Keep this similar to whatsappscraper/
Add test cases first.
Extract all useful information - including content that may not be directly displayed but is present in the DOM. My intent is to review this later to see if there's anyone I need to connect with, so plan accordingly.
For example, who are the common connects and how many do I have? Can we get more info about that directly from the DOM?
Who is premium, who is verified? Who shares a common organization / educational institution - and what is it? Who follows me and who doesn't? What message did they send me if any, and can I get the full message?
The order of invites is meaningful - it's reverse chronological. So preserve that order in the output. See if you can get the date of the invite if it's hidden somewhere - i.e. at a higher granularity than just "3 months ago", etc.
Try and get the full information instead of just what's cut off by ellipses.
Keep in mind that LinkedIn may change structure but what's visible may not change much.

I have two tabs of https://www.linkedin.com/mynetwork/invitation-manager/received/ open on CDP 9222 (use agent-browser or uvx playwright).
One where I scrolled all the way to the end
Another where it's at the top.
Test the bookmarklet on both.
Actually scroll the page to test how LinkedIn handles scrolling and loading more invites and make sure the bookmarklet can handle that.

But first, save a batch of results in linkedinscraper/invites.json. Let me review the output before you do any further processing or analysis on it. Suggest what I should review. Await my feedback.

---

Review feedback:

- name, profileUrl, followsYou looks fine.
- invitationAgeText is sometimes null (when "Yesterday") but otherwise fine - handle such cases.
- include the description, e.g. "IIM Bangalore | BITS Pilani | ARN-278889" for "Monark Shrimal"
- restructure mutualConnectionLines into a count as well as the people mentioned. Analyze all patterns and extract efficiently.
- commonOrgLines is definitely missing. Shaily Sharma and I share Straive as a common org line.
- Extract whether they are premium, verified, etc. from their aria labels or other sources - whatever is most reliable
- Extract the full message they sent. For example, Praveen uchil said "Hi Anand S, ... reconnect here"

Keep the output fields minimal, i.e.

- name
- descriptio
- profileUrl
- followsYou
- invitationAge
- connections
- connectionsCount
- commonOrgs
- badges (premium, verified, etc.)
- message

Explore the simplest, most robust way of extracting this information - maybe even from the pattern of text and aria labels, if you think that'll be more robust.

Make the output a simple array of objects. Run this and save a batch in linkedinscraper/invites-2.json. Let me review the output before you do any further processing or analysis on it. Suggest what I should review. Await my feedback.

---

Looks good. Generate the bookmarklet. Keep this similar to whatsappscraper/. Remember:

- I intend for linkedinscraper/ to be a collection of bookmarklets to scrape different sections of LinkedIn. Plan for that.
- Add anonymized test cases first - handle edge cases that you've seen
- Actually scroll the page to test how LinkedIn handles scrolling and loading more invites and make sure the bookmarklet can handle that.

Document in linkedinscraper/README.md.
Update ./tools.json and ./README.md.

---

Replace "invitationAge" with "invitationMonth" as a best guess month (YYYY-MM) of the invitation. Feel free to use a reasonable heuristic to convert "3 months ago", "Yesterday", "2 weeks ago", etc. into an actual month.

Run and test. Revise tests and docs as required.

<!-- codex resume 019e14e7-ade7-7e21-8d40-e9da9405f51d --yolo -->
