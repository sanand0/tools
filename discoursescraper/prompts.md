# Prompts

/home/sanand/.codex/sessions/2025/11/03/rollout-2025-11-03T12-50-29-019a4896-bd97-7832-8211-ddca3c73bcee.jsonl

## user_message

Add a Discourse thread scraper bookmarklet in discoursescraper/ similar to xscraper/ and whatsappscraper/ that copies a Discourse post and all its replies from a Discourse post page. Ensure that these fields are present, but you may include more fields based on the information visible on each post / reply.

- date: timestamp in ISO format
- link: permalink to the post/reply
- parent_link: permalink to the parent post/reply, null for the main post
- user_name: post/reply author name e.g. Jivraj
- user_link: post/reply author link e.g. /u/jivraj
- user_role: user title e.g. Course TA
- message: full text content of the post/reply as markdown
- likes: dict of likes, e.g. {"♥️": 5, "👍": 2}
- views: optional, applies only to post
- any other fields you find relevant

Use http://localhost:9222/json - Chrome Debug Mode to run this and verify. There is a page open from https://discourse.onlinedegree.iitm.ac.in/ which you can use. This is the page I want to scrape, so focus just on this page. If you cannot access it, stop and let me know.

Start at the beginning of the page, scroll (via page down), and don't miss any replies.

Explore the HTML. Consider capturing data from any text or attributes (e.g. aria-labels).

Don't try to access Discourse directly, e.g. via curl. Only use CDP to inspect / scrape.

The objective is to create a bookmarklet, like the existing ones in xscraper/ and whatsappscraper/.
