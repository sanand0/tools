# LinkedIn Scraper Bookmarklets

Collection of LinkedIn bookmarklets that copy structured page data from your browser.

## Bookmarklets

- **Invite Scraper**: Scrapes received invitations from `https://www.linkedin.com/mynetwork/invitation-manager/received/`.

## Invite Output

The invite scraper copies a JSON array. Each object may include:

- `name`
- `description`
- `profileUrl`
- `followsYou`
- `invitationAge`
- `connections`
- `connectionsCount`
- `commonOrgs`
- `badges`
- `message`

The bookmarklet auto-scrolls from the top of the invitation page and keeps merging newly loaded invitations until you click the floating copy button.
