# LinkedIn Scraper Bookmarklets

Collection of LinkedIn bookmarklets that copy structured page data from your browser.

## Bookmarklets

- **LinkedIn Invite Scraper**: Scrapes received invitations from `https://www.linkedin.com/mynetwork/invitation-manager/received/`.
- **LinkedIn Profile Scraper**: Scrapes a LinkedIn profile page into AI-agent friendly Markdown.

## Invite Output

The invite scraper copies a JSON array. Each object may include:

- `name`
- `description`
- `profileUrl`
- `followsYou`
- `invitationMonth`
- `connections`
- `connectionsCount`
- `commonOrgs`
- `badges`
- `message`

The bookmarklet auto-scrolls from the top of the invitation page and keeps merging newly loaded invitations until you click the floating copy button.

`invitationMonth` is a best-guess `YYYY-MM` value based on LinkedIn's relative text, for example `Yesterday`,
`2 weeks ago`, or `3 months ago`, evaluated at scrape time.

## Profile Output

The profile scraper copies Markdown. It expands visible content, scrolls through the profile until lazy-loaded sections stop appearing, and groups the visible profile text by page section.
