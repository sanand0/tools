// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const button = document.getElementById("bookmarklet");
const status = document.getElementById("bookmarklet-status");
const spinner = document.getElementById("bookmarklet-spinner");

try {
  const response = await fetch("bookmarklet.js");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const code = await response.text();
  button.setAttribute("href", "javascript:" + encodeURIComponent(code));
  button.classList.remove("disabled");
  button.removeAttribute("aria-disabled");
  status.textContent = "Ready. Drag the button to your bookmarks bar.";
} catch (error) {
  status.textContent = "Unable to load bookmarklet. Reload to try again.";
  bootstrapAlert({ title: "Bookmarklet unavailable", body: String(error), color: "danger" });
} finally {
  spinner.classList.add("d-none");
}
