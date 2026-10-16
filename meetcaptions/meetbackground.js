// @ts-check
(() => {
  if (location.hostname !== "meet.google.com") {
    alert("Open Google Meet before using this bookmarklet.");
    return;
  }

  // Meet's image-only file picker also accepts MP4 if its filter is extended.
  const input = document.querySelector('input[type="file"][accept*="image/png"]');
  if (!input) {
    alert("Open Backgrounds and effects → Backgrounds in Google Meet, then click this bookmarklet again.");
    return;
  }

  if (!input.accept.split(",").some((type) => type.trim() === "video/mp4")) input.accept += ", video/mp4";
  input.click();
})();
