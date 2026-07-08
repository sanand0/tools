# LinkedIn Scraper Notes

## Invite page, 2026-06-27

- Live page checked: `https://www.linkedin.com/mynetwork/invitation-manager/received/` via CDP 9222, with 200 loaded received invites.
- Current invite cards are still identifiable with `[role="listitem"][componentkey^="urn:li:invitation:"]`.
- LinkedIn no longer exposes an invite age on the received-invites cards I inspected. Keep `invitationMonth` as the current month plus `?` unless a visible age appears before the action buttons.
- Do not search the whole card for age text. A message can contain words like `today`, which caused a false `invitationMonth` and split the message.
- The reliable current message boundary is structural: message paragraphs appear after the `Ignore` / `Accept` action buttons and before a `Reply to ...` link. Read post-action paragraph text and strip `show more`, `show less`, and `Reply to ...` chrome.
- `company-accent-4` is not a shared-organization signal anymore. It appears as the generic icon beside many headline/description rows, so treating it as common-org evidence turns taglines into `commonOrgs`.
- Only populate `commonOrgs` when the row explicitly says it is a `common` or `shared` organization/school/company/institution. On the 200-card live sample, no such explicit common-org rows were visible, so `commonOrgCount` was 0.
- The old auto-scroll started with a forced scroll-to-top phase. On already-loaded invite pages this makes the viewport jump upward before moving down. Invite scraping now starts in the downward phase and preserves first-seen order through merge state.

Regression anchor from the live page:

- `Udaibir Singh` had description `Digital strategist - business, marketing & product...`, mutual connection `Josey Puliyenthuruthel John and 12 other mutual connections`, and message `Hi Anand, thank you for the lovely session today...`.
- Before the fix, the first sentence of that message became `description`, the real description became `commonOrgs`, and `today` in the message became a false certain `invitationMonth`.
- After the fix, a read-only parse of 200 loaded invites produced no note-like descriptions, no tagline-like common orgs, 11 messages, and 0 explicit common orgs.
