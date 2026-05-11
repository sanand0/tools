// @ts-check

async function loadBookmarklet() {
  try {
    const response = await fetch("linkedinscraper.min.js");
    if (!response.ok) throw new Error(`Failed to load bookmarklet: ${response.status}`);
    const code = await response.text();
    const bookmarklet = document.getElementById("invite-bookmarklet");
    bookmarklet.href = `javascript:${encodeURIComponent(`${code};linkedinscraper.scrapeInvites();`)}`;
  } catch (error) {
    document
      .querySelector("main")
      .insertAdjacentHTML("afterbegin", `<div class="alert alert-danger" role="alert">${error.message}</div>`);
  }
}

loadBookmarklet();
