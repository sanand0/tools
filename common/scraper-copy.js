// @ts-check

export function mountScraperCopyControls({ document, idPrefix, noun, onCopy }) {
  const controlsId = `${idPrefix}-copy-controls`;
  document.getElementById(controlsId)?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="${controlsId}" role="group" aria-label="Copy captured ${noun}" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:14px system-ui,sans-serif;"><button id="${idPrefix}-copy-markdown-btn" data-format="markdown" style="padding:8px 10px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer;"></button><button id="${idPrefix}-copy-json-btn" data-format="json" style="padding:8px 10px;background:#fff;color:#111;border:1px solid #777;border-radius:5px;cursor:pointer;"></button></div>`,
  );
  const controls = document.getElementById(controlsId);
  controls.addEventListener("click", (event) => {
    const button = event.target.closest?.("button[data-format]");
    if (button) onCopy(button.dataset.format);
  });
  return {
    remove: () => controls.remove(),
    updateCount(count) {
      for (const format of ["markdown", "json"]) {
        document.getElementById(`${idPrefix}-copy-${format}-btn`).textContent =
          `Copy ${count} ${noun} as ${format === "json" ? "JSON" : "Markdown"}`;
      }
    },
  };
}
