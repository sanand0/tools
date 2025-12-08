const bookmarkletButton = document.getElementById("bookmarklet");
const statusText = document.getElementById("bookmarklet-status");
const messageArea = document.getElementById("message-area");

const showError = (message) => {
  const alert = document.createElement("div");
  alert.className = "alert alert-danger alert-dismissible fade show";
  alert.role = "alert";
  alert.innerHTML = /* html */ `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  messageArea.replaceChildren(alert);
};

const updateStatus = (text) => {
  statusText.textContent = text;
};

const loadBookmarklet = async () => {
  updateStatus("Loading bookmarklet…");
  try {
    const response = await fetch("bookmarklet.min.js");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const code = await response.text();
    bookmarkletButton.href = "javascript:" + encodeURIComponent(`${code};hnMd.copyThread();`);
    updateStatus("Drag the button to your bookmarks bar, then click it on a Hacker News thread.");
  } catch (error) {
    updateStatus("Failed to load bookmarklet.");
    showError(`Unable to load the bookmarklet: ${error.message}`);
  }
};

loadBookmarklet();
