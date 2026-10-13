# Dark Mode

Toggle readable dark mode for Gmail messages and Hacker News with a bookmarklet.

Drag **Dark mode toggle** to your bookmarks bar, then run it on Gmail
(`https://mail.google.com/*`) or Hacker News (`https://news.ycombinator.com/*`).
Run it again to restore the original appearance.
The theme applies to the current document; a full navigation or reload resets it.
Unsupported hosts show a notice without changing the page.

Gmail themes rendered message bodies (`.ii.gt .a3s`) and the surrounding conversation
pane (`.iY`), including subject, sender, attachments and inline reply surfaces, so
the dark body does not sit inside a white box. The mail list and separate compose
windows keep their appearance. Run it from the inbox or
an open message: the stylesheet stays in the document head as Gmail replaces
bodies during navigation, searches, reading-pane changes or conversation expansion.
All accounts on the exact Gmail host use the same rules. New tabs, pop-out windows
and “View entire message” pages are separate documents; run the bookmarklet there
if they render Gmail's message containers. Print and plain source views are not themed.

Sender text, link, background and border colors are normalized for readable contrast,
including legacy HTML, tables, quoted replies and inline styles. Inline gradients
are removed. Images and background images retain their pixels; image-only text and
text over background images retain the sender's contrast. Layout, hidden content
and text direction are preserved. Inline `!important` declarations can still take
precedence over the stylesheet. Gmail's private container classes may change;
if messages stop matching, update the Gmail selector and fixtures.

The bookmarklet embeds its CSS and makes no network requests. It adds one stylesheet
and removes it on the next run, preserving markup, layout, images, forms, and site
behavior. New elements automatically inherit the theme. Downvoted comments remain
muted with readable contrast; visited links, hover, focus, selection, and native
controls have explicit dark colors. Hacker News keeps its orange navigation bar.

To add a site, add an exact hostname with a `name` and `css` to `themes` in `bookmarklet.js` and
cover the site's pages and interactive states in tests. Reinstall the bookmarklet
after changes to get the updated embedded themes.

Validation: `npm test -- darkmode`. `gmail.fixture.html` covers plain text,
newsletters, tables, images, hidden preheaders, quoted threads, code, RTL and
already dark mail. Real-browser checks also cover inline background shorthands,
search/navigation and contrast; Happy DOM does not resolve all CSS shorthands like
Chrome. Hacker News checks cover lists, threads (including collapsed/downvoted
comments), forms, and help pages.
