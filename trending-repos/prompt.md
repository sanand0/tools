Create a trending-repos/ tool in the style of the other recent tools.

Take a look at https://raw.githubusercontent.com/sanand0/til/refs/heads/live/trending-repos.tsv
This is created weekly by https://raw.githubusercontent.com/sanand0/til/refs/heads/live/trending-repos.sh
Columns are: status, language, stars, currentStars, date, repo name, description, notes

The first column indicating status.
  🟣 - To be evaluated.
  🟢 - Used.
  ⏺️ - Interesting.
  🔴 - Unused.
  🔵 - Deferred.

Show a reponsive table view (occupying full width: container-fluid) with compact rows for quick scanning.
- Use the actual emoji status indicators (🟣🟢⏺️🔴🔵)
- Show date like 13 Aug 2025. Ensure it does not wrap
- Clicking on the row opens the GitHub page in a new window

Before the table, show filters for status (dropdown with checkboxes) and language (dropdown with checkboxes) and a button to clear all filters
Clicking on any column header should sort by that column / toggle sort order.

Above the table, show a single-row summary count by status

Encode filter state in URL query params: `?status=🟢&status=🔴&lang=rs`... for shareable filtered views

Use lit-html for performant updates.
Write minimal code.
No tests required.
