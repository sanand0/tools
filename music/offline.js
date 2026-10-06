// @ts-check
const status = document.getElementById("offline-status");
let registration;
let updating = false;
let updateAvailable = false;
let offlineReady = false;
let dismissed = false;
let lastCheck = 0;
let checking = false;

function postToWorker(message) {
  (registration?.active || registration?.waiting || navigator.serviceWorker.controller)?.postMessage(message);
}

function showStatus(message, action, label) {
  status.title = message === "Offline ready" ? "The player shell is cached for flight mode." : "";
  status.replaceChildren();
  if (message.endsWith("…")) {
    const spinner = document.createElement("span");
    spinner.className = "spinner-border spinner-border-sm me-2";
    spinner.setAttribute("aria-hidden", "true");
    status.append(spinner);
  }
  const text = document.createElement("span");
  text.textContent = message;
  status.append(text);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm";
    button.textContent = label;
    button.addEventListener("click", action);
    status.append(" ", button);
  }
  status.hidden = false;
}
function showUpdate() {
  updateAvailable = true;
  if (dismissed) return;
  showStatus("An update is ready.", () => {
    updating = true;
    showStatus("Updating player…");
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    else postToWorker({ type: "APPLY_UPDATE" });
  }, "Refresh");
  const later = document.createElement("button");
  later.type = "button";
  later.className = "btn btn-sm";
  later.textContent = "Later";
  later.addEventListener("click", () => {
    dismissed = true;
    showStatus(navigator.onLine ? "Offline ready" : "Offline mode");
  });
  status.append(" ", later);
}
function checkUpdate() {
  if (!navigator.onLine || !registration || checking) return;
  checking = true;
  lastCheck = Date.now();
  registration.update().catch(() => {});
  postToWorker({ type: "CHECK_UPDATE" });
}
async function registerOffline() {
  showStatus("Offlining…");
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    showStatus("Offline setup needs HTTPS or localhost and a supported browser.");
    return;
  }
  try {
    registration = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
    const hadActiveWorker = Boolean(registration.active);
    const watchInstall = () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration.waiting && registration.active) showUpdate();
        if (worker.state === "redundant") showStatus("Offline setup failed. Reconnect and retry.", registerOffline, "Retry");
      });
    };
    registration.addEventListener("updatefound", watchInstall);
    watchInstall();
    if (registration.waiting) showUpdate();
    await navigator.serviceWorker.ready;
    postToWorker({ type: "GET_STATUS" });
    // Installation has just fetched the shell; only returning visits need another check.
    if (hadActiveWorker) checkUpdate();
  } catch {
    showStatus("Offline setup failed. Reconnect and retry.", registerOffline, "Retry");
  }
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", ({ data }) => {
    if (["OFFLINE_READY", "UPDATE_READY", "UPDATE_CHECK_FAILED", "OFFLINE_UNAVAILABLE"].includes(data?.type)) checking = false;
    if (data?.type === "UPDATE_READY") showUpdate();
    if (data?.type === "OFFLINE_READY") {
      offlineReady = true;
      if (!registration?.waiting) {
        updateAvailable = false;
        showStatus(navigator.onLine ? "Offline ready" : "Offline mode");
      }
    }
    if (["UPDATE_CHECK_FAILED", "OFFLINE_UNAVAILABLE"].includes(data?.type)) {
      if (!updateAvailable) showStatus("Offline check failed. Reconnect and retry.", checkUpdate, "Retry");
    }
    if (data?.type === "UPDATE_APPLIED" && updating) window.location.reload();
    if (data?.type === "UPDATE_APPLY_FAILED") {
      updating = false;
      dismissed = false;
      updateAvailable = false;
      showStatus("Could not update. Reconnect and retry.", checkUpdate, "Retry");
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) window.location.reload();
    else postToWorker({ type: "GET_STATUS" });
  });
}
window.addEventListener("online", () => {
  if (!registration) registerOffline();
  else checkUpdate();
});
window.addEventListener("offline", () => {
  if (!updateAvailable || dismissed)
    showStatus(offlineReady ? "Offline mode" : "Offline setup incomplete. Reconnect before travel.");
});
window.addEventListener("focus", () => {
  if (Date.now() - lastCheck > 5 * 60 * 1000) checkUpdate();
});
registerOffline();
