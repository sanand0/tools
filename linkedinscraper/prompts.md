# Prompts

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

<!-- codex resume 019e14e7-ade7-7e21-8d40-e9da9405f51d --yolo -->
