# Dark Mode

Toggle a readable dark theme on supported sites with a bookmarklet.

Drag **Dark mode toggle** to your bookmarks bar, then run it on any Hacker News page
(`https://news.ycombinator.com/*`). Run it again to restore the original appearance.
The theme applies to the current document; navigation or reload resets it.
Unsupported hosts show a notice without changing the page.

The bookmarklet embeds its CSS and makes no network requests. It adds one stylesheet
and removes it on the next run, preserving markup, layout, images, forms, and site
behavior. New elements automatically inherit the theme. Downvoted comments remain
muted with readable contrast; visited links, hover, focus, selection, and native
controls have explicit dark colors. Hacker News keeps its orange navigation bar.

To add a site, add an exact hostname and CSS to `themes` in `bookmarklet.js` and
cover the site's pages and interactive states in tests. Reinstall the bookmarklet
after changes to get the updated embedded themes.

Validation: `npm test -- darkmode`. Real-browser contrast checks should cover lists,
threads (including collapsed/downvoted comments), forms, and help pages.
