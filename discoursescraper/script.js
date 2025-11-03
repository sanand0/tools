const bookmarklet = document.getElementById("bookmarklet");

async function setupBookmarklet() {
  try {
    const response = await fetch("discoursescraper.min.js");
    if (!response.ok) throw new Error(`Failed to load bookmarklet: ${response.status}`);
    const code = await response.text();
    const bookmarkletCode = `${code};discoursescraper.scrape();`;
    bookmarklet.href = `javascript:${encodeURIComponent(bookmarkletCode)}`;
  } catch (error) {
    const alert = document.getElementById("bookmarklet-error");
    if (alert) alert.textContent = `Unable to prepare bookmarklet: ${error.message}`;
    throw error;
  }
}

setupBookmarklet();
