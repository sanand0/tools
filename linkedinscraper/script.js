// @ts-check

async function loadBookmarklet() {
  try {
    const response = await fetch("linkedinscraper.min.js");
    if (!response.ok) throw new Error(`Failed to load bookmarklet: ${response.status}`);
    const code = await response.text();
    const inviteBookmarklet = document.getElementById("invite-bookmarklet");
    const profileBookmarklet = document.getElementById("profile-bookmarklet");
    inviteBookmarklet.href = `javascript:${encodeURIComponent(`${code};linkedinscraper.scrapeInvites();`)}`;
    profileBookmarklet.href = `javascript:${encodeURIComponent(`${code};linkedinscraper.scrapeProfile();`)}`;
  } catch (error) {
    document
      .querySelector("main")
      .insertAdjacentHTML("afterbegin", `<div class="alert alert-danger" role="alert">${error.message}</div>`);
  }
}

loadBookmarklet();
