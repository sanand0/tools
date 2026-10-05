// @ts-check

export function mountScraperCopyControls({ document, idPrefix, noun, onCopy, onClose }) {
  const controlsId = `${idPrefix}-copy-controls`;
  document.getElementById(controlsId)?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="${controlsId}" role="group" aria-label="Copy captured ${noun}" style="position:fixed;top:10px;right:10px;display:flex;gap:6px;padding:6px;z-index:2147483647;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:14px system-ui,sans-serif;color-scheme:light;"><button id="${idPrefix}-copy-markdown-btn" data-format="markdown" style="padding:8px 10px;background:#0d6efd;color:#fff;border:1px solid #0d6efd;border-radius:5px;cursor:pointer;"></button><button id="${idPrefix}-copy-json-btn" data-format="json" style="padding:8px 10px;background:#fff;color:#111;border:1px solid #777;border-radius:5px;cursor:pointer;"></button><button id="${idPrefix}-copy-close-btn" type="button" data-action="close" aria-label="Close scraper controls" title="Close" style="padding:2px 10px;background:#dc3545;color:#fff;border:1px solid #dc3545;border-radius:5px;cursor:pointer;">×</button></div>`,
  );
  const controls = document.getElementById(controlsId);
  const feedbackTimers = new Map();
  const remove = () => {
    for (const timer of feedbackTimers.values()) document.defaultView.clearTimeout(timer);
    controls.remove();
  };
  const restoreButton = (button) => {
    button.textContent = button.dataset.copyLabel;
    button.style.background = button.dataset.copyBackground;
    button.style.borderColor = button.dataset.copyBorder;
    button.removeAttribute("aria-live");
    button.dataset.feedback = "";
  };
  controls.addEventListener("click", (event) => {
    const button = event.target.closest?.("button[data-format]");
    if (button) {
      clearTimeout(feedbackTimers.get(button));
      button.dataset.copyBackground ||= button.style.background;
      button.dataset.copyBorder ||= button.style.borderColor;
      button.disabled = true;
      Promise.resolve(onCopy(button.dataset.format))
        .then((copied) => {
          button.disabled = false;
          button.textContent = copied === false ? "Copy failed" : "Copied";
          button.style.background = copied === false ? "#dc3545" : "#198754";
          button.style.borderColor = button.style.background;
          button.dataset.feedback = "true";
          button.setAttribute("aria-live", "polite");
          feedbackTimers.set(button, document.defaultView.setTimeout(() => restoreButton(button), 3000));
        })
        .catch(() => {
          button.disabled = false;
          button.textContent = "Copy failed";
          button.style.background = "#dc3545";
          button.style.borderColor = "#dc3545";
          button.dataset.feedback = "true";
          button.setAttribute("aria-live", "polite");
          feedbackTimers.set(button, document.defaultView.setTimeout(() => restoreButton(button), 3000));
        });
    }
    if (event.target.closest?.("button[data-action='close']")) {
      onClose?.();
      remove();
    }
  });
  return {
    remove,
    updateCount(count) {
      for (const format of ["markdown", "json"]) {
        const button = document.getElementById(`${idPrefix}-copy-${format}-btn`);
        button.dataset.copyLabel = `Copy ${count} ${noun} as ${format === "json" ? "JSON" : "Markdown"}`;
        if (!button.dataset.feedback) button.textContent = button.dataset.copyLabel;
      }
    },
  };
}
