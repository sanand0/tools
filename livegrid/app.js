// @ts-check

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STORAGE_PREFIX = "livegrid:";
const DELETED_PREFIX = "livegrid:deleted:";
const DEFAULT_COLOR = "rgb(91, 155, 213)";
const DRAG_HANDLE_HEIGHT = 20;
const colors = [
  DEFAULT_COLOR,
  "rgb(237, 125, 49)",
  "rgb(165, 165, 165)",
  "rgb(255, 192, 0)",
  "rgb(112, 173, 71)",
];

function fallbackSanitizer(document) {
  const blocked = new Set([
    "BASE",
    "EMBED",
    "FORM",
    "IFRAME",
    "LINK",
    "META",
    "OBJECT",
    "SCRIPT",
    "STYLE",
  ]);
  return (html) => {
    const template = document.createElement("template");
    template.innerHTML = String(html ?? "");
    for (const element of template.content.querySelectorAll("*")) {
      if (blocked.has(element.tagName)) {
        element.remove();
        continue;
      }
      for (const attribute of [...element.attributes]) {
        const value = attribute.value.trim().toLowerCase();
        if (
          attribute.name.toLowerCase().startsWith("on") ||
          value.startsWith("javascript:")
        )
          element.removeAttribute(attribute.name);
      }
    }
    return template.innerHTML;
  };
}

/**
 * Wire the LiveGrid DOM to a whole-document Firestore adapter.
 * Firebase is injected so browser integration tests can exercise multiple pages without network calls.
 */
export function createLiveGrid({
  window,
  document,
  storage = window.localStorage,
  firebase,
  qrCode,
  showAlert,
  sanitizeHtml = fallbackSanitizer(document),
  debounceMs = 500,
  randomUUID = () => window.crypto.randomUUID(),
}) {
  const container = document.getElementById("container");
  const items = document.getElementById("items");
  const gridbase = document.getElementById("gridbase");
  const grid = document.getElementById("grid");
  const notes = document.getElementById("notes");
  const heading = document.getElementById("app-name");
  const status = document.getElementById("connection-status");
  const roomList = document.getElementById("app-list");
  const roomSelect = document.getElementById("app-list-select");
  const measuredBox = gridbase.getBBox();
  const box = {
    width: measuredBox.width || Number(gridbase.getAttribute("width")),
    height: measuredBox.height || Number(gridbase.getAttribute("height")),
  };
  const pad = 8;
  let labels = {
    row: ["Urgent", "Slightly urgent", "Not urgent"],
    col: ["Not important", "Slightly important", "Important"],
  };
  let roomId;
  let roomRef;
  let cacheKey;
  let deletedKey;
  let unsubscribe;
  let writeTimer;
  let pendingState;
  let applyingState = false;
  let initializationAttempted = false;
  let deliberatelyDeleted = false;
  let seenRemoteRoom = false;

  const clear = (node) => node.replaceChildren();
  const strip = (text) => text.replace(/\s+/g, " ").trim();
  const svg = (tag, attrs, text) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs))
      element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const on = (event, className, handler) =>
    container.addEventListener(event, (e) => {
      if (e.target.classList.contains(className)) handler(e);
    });

  function setStatus(message, state = "connecting") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function reportError(title, error, prefix = title) {
    const message = error?.message || String(error);
    const permission = error?.code === "permission-denied";
    const offline = error?.code === "unavailable";
    if (offline) setStatus("Offline — changes saved locally", "offline");
    else
      setStatus(
        permission
          ? "Permission denied — local only"
          : `${prefix} — local only`,
        "error",
      );
    showAlert({ title, body: message, color: "danger", replace: true });
    console.error(`${title}:`, error);
  }

  function setHeading(name) {
    for (const node of document.querySelectorAll(".app-name"))
      node.textContent = name;
  }

  // Firestore keeps the original 920×559 coordinates; percentages only control responsive rendering.
  function positionItem(item, x, y) {
    item.dataset.x = String(x);
    item.dataset.y = String(y);
    item.style.left = `${(x / box.width) * 100}%`;
    item.style.top = `${(y / box.height) * 100}%`;
  }

  function keepItemInBounds(item, x, y) {
    const containerBounds = container.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    const scaleX = box.width / (containerBounds.width || box.width);
    const scaleY = box.height / (containerBounds.height || box.height);
    const maxX = Math.max(0, box.width - itemBounds.width * scaleX);
    const maxY = Math.max(0, box.height - itemBounds.height * scaleY);
    const minY = Math.min(DRAG_HANDLE_HEIGHT * scaleY, maxY);
    positionItem(
      item,
      Math.min(maxX, Math.max(0, x)),
      Math.min(maxY, Math.max(minY, y)),
    );
  }

  function addItem(itemState) {
    const item = document.createElement("div");
    item.setAttribute("draggable", "true");
    item.setAttribute("class", "item");
    item.setAttribute("contentEditable", "true");
    positionItem(item, itemState.x, itemState.y);
    item.innerHTML = sanitizeHtml(itemState.t);
    item.style.borderColor = itemState.c || DEFAULT_COLOR;
    items.appendChild(item);
    keepItemInBounds(item, itemState.x, itemState.y);
    return item;
  }

  function coordinate(value, line) {
    const input = value?.trim() ?? "";
    const number = Number(input.replace(/%$/, ""));
    if (!input || !Number.isFinite(number))
      throw new Error(
        `Line ${line}: X and Y must be percentages or fractions.`,
      );
    const fraction =
      input.endsWith("%") || Math.abs(number) > 1 ? number / 100 : number;
    return Math.min(1, Math.max(0, fraction));
  }

  function importNotes(value) {
    const rows = value.split(/\r?\n/).filter((line) => line.trim());
    const imported = rows.map((line, index) => {
      const [text, x, y] = line.split("\t");
      if (!strip(text ?? "") || x === undefined || y === undefined)
        throw new Error(`Line ${index + 1}: expected text, X, and Y.`);
      return {
        t: text.trim(),
        x: coordinate(x, index + 1) * box.width,
        y: (1 - coordinate(y, index + 1)) * box.height,
        c: DEFAULT_COLOR,
      };
    });
    imported.forEach(addItem);
    if (imported.length) save();
    return imported.length;
  }

  function currentState() {
    return {
      item: [...document.querySelectorAll(".item")].map((node) => ({
        x: Number(node.dataset.x ?? Number.parseFloat(node.style.left)),
        y: Number(node.dataset.y ?? Number.parseFloat(node.style.top)),
        t: node.innerHTML,
        c: window.getComputedStyle(node).borderTopColor,
      })),
      row: [...labels.row],
      col: [...labels.col],
      name: heading.textContent,
      notes: notes.innerHTML,
      publish_url: "",
    };
  }

  function normalizeState(value = {}) {
    const fallback = currentState();
    return {
      item: Array.isArray(value.item)
        ? value.item.map((item) => ({
            x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 0,
            y: Number.isFinite(Number(item?.y)) ? Number(item.y) : 0,
            t: sanitizeHtml(item?.t ?? ""),
            c: typeof item?.c === "string" ? item.c : DEFAULT_COLOR,
          }))
        : fallback.item,
      row: Array.isArray(value.row) ? value.row.map(String) : fallback.row,
      col: Array.isArray(value.col) ? value.col.map(String) : fallback.col,
      name: typeof value.name === "string" ? value.name : "LiveGrid",
      notes: sanitizeHtml(value.notes ?? "Your notes here"),
      publish_url:
        typeof value.publish_url === "string" ? value.publish_url : "",
    };
  }

  function drawGrid({ persist = true } = {}) {
    clear(grid);
    for (let i = 0, n = labels.col.length, width = box.width / n; i < n; i++) {
      grid.appendChild(svg("path", { d: `M${i * width},0 v${box.height}` }));
      grid.appendChild(
        svg(
          "text",
          {
            id: `col:${i}`,
            class: "label legend",
            x: (i + 0.5) * width,
            y: box.height - pad,
            "text-anchor": "middle",
          },
          labels.col[i],
        ),
      );
    }
    for (
      let i = 0, n = labels.row.length, height = box.height / n;
      i < n;
      i++
    ) {
      const y = (n - 0.5 - i) * height;
      grid.appendChild(
        svg("path", { d: `M0,${y + height * 0.5} h${box.width}` }),
      );
      grid.appendChild(
        svg(
          "text",
          {
            id: `row:${i}`,
            class: "label legend",
            x: 0,
            y: y + pad,
            dy: "0.35em",
            "text-anchor": "middle",
            transform: `rotate(-90,5,${y})`,
          },
          labels.row[i],
        ),
      );
    }
    if (persist) save();
  }

  function load(value, { cache = false } = {}) {
    const next = normalizeState(value);
    applyingState = true;
    try {
      setHeading(next.name);
      labels = { row: next.row, col: next.col };
      notes.innerHTML = next.notes;
      clear(items);
      next.item.forEach(addItem);
      drawGrid({ persist: false });
      if (cache) storage.setItem(cacheKey, JSON.stringify(next));
    } finally {
      applyingState = false;
    }
  }

  async function writeRemote(value) {
    if (deliberatelyDeleted || !roomRef) return;
    try {
      await firebase.setDoc(roomRef, value);
      setStatus("Connected", "connected");
    } catch (error) {
      reportError("Firestore write failed", error, "Write failed");
    }
  }

  function scheduleRemoteWrite(value = currentState(), delay = debounceMs) {
    pendingState = normalizeState(value);
    window.clearTimeout(writeTimer);
    writeTimer = window.setTimeout(() => writeRemote(pendingState), delay);
  }

  function save() {
    const value = currentState();
    storage.setItem(cacheKey, JSON.stringify(value));
    showStates();
    if (!applyingState && !deliberatelyDeleted) scheduleRemoteWrite(value);
  }

  const defaultState = normalizeState(currentState());

  function cachedState() {
    const raw = storage.getItem(cacheKey);
    if (!raw) return null;
    try {
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      reportError("Local cache is invalid", error, "Cache error");
      return null;
    }
  }

  function showStates() {
    clear(roomList);
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      const id = key?.startsWith(STORAGE_PREFIX)
        ? key.slice(STORAGE_PREFIX.length)
        : "";
      if (!UUID_V4.test(id)) continue;
      try {
        const value = JSON.parse(storage.getItem(key));
        const option = document.createElement("option");
        option.id = id;
        option.value = id;
        option.selected = id === roomId;
        option.textContent = value.name || id;
        roomList.appendChild(option);
      } catch {
        // Ignore malformed unrelated cache entries; cachedState reports the active one.
      }
    }
  }

  async function handleSnapshot(snapshot) {
    if (snapshot.exists()) {
      seenRemoteRoom = true;
      deliberatelyDeleted = false;
      storage.removeItem(deletedKey);
      load(snapshot.data(), { cache: true });
      showStates();
      setStatus(
        snapshot.metadata.fromCache ? "Offline — cached room" : "Connected",
        snapshot.metadata.fromCache ? "offline" : "connected",
      );
      return;
    }
    if (snapshot.metadata.fromCache) {
      setStatus("Offline — changes saved locally", "offline");
      return;
    }
    if (
      deliberatelyDeleted ||
      seenRemoteRoom ||
      storage.getItem(deletedKey) === "1"
    ) {
      deliberatelyDeleted = true;
      storage.setItem(deletedKey, "1");
      storage.removeItem(cacheKey);
      showStates();
      setStatus("Room deleted", "deleted");
      return;
    }
    if (initializationAttempted) return;
    initializationAttempted = true;
    try {
      await firebase.setDoc(
        roomRef,
        normalizeState(cachedState() ?? currentState()),
      );
    } catch (error) {
      reportError("Firestore room creation failed", error, "Creation failed");
    }
  }

  function validRoomId() {
    const hash = window.location.hash.slice(1).toLowerCase();
    if (UUID_V4.test(hash)) return hash;
    const generated = randomUUID().toLowerCase();
    window.history.replaceState(null, "", `#${generated}`);
    return generated;
  }

  function connectRoom({ fresh = false } = {}) {
    unsubscribe?.();
    window.clearTimeout(writeTimer);
    roomId = validRoomId();
    cacheKey = `${STORAGE_PREFIX}${roomId}`;
    deletedKey = `${DELETED_PREFIX}${roomId}`;
    roomRef = firebase.doc(firebase.db, "rooms", roomId);
    initializationAttempted = false;
    deliberatelyDeleted = storage.getItem(deletedKey) === "1";
    seenRemoteRoom = false;
    load(fresh ? defaultState : (cachedState() ?? defaultState));
    showStates();
    setStatus(
      deliberatelyDeleted ? "Room deleted" : "Connecting…",
      deliberatelyDeleted ? "deleted" : "connecting",
    );
    const subscribedRoomId = roomId;
    unsubscribe = firebase.onSnapshot(
      roomRef,
      (snapshot) => {
        if (roomId === subscribedRoomId) handleSnapshot(snapshot);
      },
      (error) => {
        if (roomId === subscribedRoomId)
          reportError("Firestore connection failed", error, "Connection error");
      },
    );
  }

  function navigateToRoom(id, fresh = false) {
    window.history.pushState(null, "", `#${id}`);
    connectRoom({ fresh });
  }

  function newRoom() {
    navigateToRoom(randomUUID().toLowerCase(), true);
  }

  async function deleteRoom() {
    if (
      !window.confirm(
        "Delete this shared room for everyone? This cannot be undone.",
      )
    )
      return;
    window.clearTimeout(writeTimer);
    deliberatelyDeleted = true;
    storage.setItem(deletedKey, "1");
    try {
      await firebase.deleteDoc(roomRef);
      storage.removeItem(cacheKey);
      showStates();
      setStatus("Room deleted", "deleted");
    } catch (error) {
      deliberatelyDeleted = false;
      storage.removeItem(deletedKey);
      reportError("Firestore room deletion failed", error, "Delete failed");
    }
  }

  async function shareRoom() {
    const url = window.location.href;
    try {
      if (window.navigator.share)
        await window.navigator.share({
          title: heading.textContent,
          text: "Anyone with this link can edit this LiveGrid.",
          url,
        });
      else await window.navigator.clipboard.writeText(url);
    } catch (error) {
      if (error?.name !== "AbortError")
        reportError("Share failed", error, "Share failed");
    }
  }

  async function showQrCode() {
    const dialog = document.getElementById("qr-dialog");
    const canvas = document.getElementById("qr-code");
    const url = window.location.href;
    document.getElementById("qr-url").textContent = url;
    try {
      await qrCode.toCanvas(canvas, url, { width: 256, margin: 1 });
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch (error) {
      reportError("QR code failed", error, "QR error");
    }
  }

  let startX;
  let startY;
  on("dragstart", "item", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    event.dataTransfer?.setData("text", "");
  });
  on("dragend", "item", (event) => {
    const bounds = container.getBoundingClientRect();
    const scaleX = box.width / (bounds.width || box.width);
    const scaleY = box.height / (bounds.height || box.height);
    keepItemInBounds(
      event.target,
      Number(event.target.dataset.x) + (event.clientX - startX) * scaleX,
      Number(event.target.dataset.y) + (event.clientY - startY) * scaleY,
    );
    save();
  });
  on("focusout", "item", (event) => {
    if (!event.target.textContent) {
      if (event.target.timeout) window.clearTimeout(event.target.timeout);
      event.target.timeout = window.setTimeout(() => {
        if (
          !event.target.textContent &&
          event.target.classList.contains("to-be-deleted")
        ) {
          event.target.remove();
          save();
        } else event.target.classList.remove("to-be-deleted");
        delete event.target.timeout;
      }, 5000);
      event.target.classList.add("to-be-deleted");
    } else save();
  });
  on("focusin", "item", (event) =>
    event.target.classList.remove("to-be-deleted"),
  );
  on("click", "label", (event) => {
    const [axis, rawIndex] = event.target.id.split(":");
    const index = Number(rawIndex);
    const currentLabel = labels[axis][index];
    const next = window.prompt(
      `Rename "${currentLabel}". (Or make it blank to delete)`,
      currentLabel,
    );
    if (next === null) return;
    const label = strip(next);
    if (label) labels[axis][index] = label;
    else labels[axis].splice(index, 1);
    drawGrid();
  });
  on("click", "add-label", (event) => {
    const axis = event.target.id.split(":")[0];
    const value = window.prompt(`Add ${axis}`, "Name");
    if (value === null) return;
    const label = strip(value);
    if (label) {
      labels[axis].push(label);
      drawGrid();
    }
  });
  on("click", "item", (event) => {
    if (!event.ctrlKey) return;
    const index = colors.indexOf(
      window.getComputedStyle(event.target).borderTopColor,
    );
    event.target.style.borderColor =
      colors[index < 0 ? 1 : (index + 1) % colors.length];
    save();
  });

  document.getElementById("add-item").addEventListener("click", function () {
    const bounds = container.getBoundingClientRect();
    addItem({
      x:
        (this.getBoundingClientRect().left - bounds.left) *
        (box.width / (bounds.width || box.width)),
      y: -10,
      t: "New item",
      c: DEFAULT_COLOR,
    }).focus();
    save();
  });
  heading.addEventListener("focusout", (event) => {
    setHeading(event.target.textContent);
    save();
  });
  notes.addEventListener("focusout", save);
  document.getElementById("import-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("import-notes");
    try {
      if (importNotes(input.value)) input.value = "";
    } catch (error) {
      showAlert({
        title: "Import failed",
        body: error.message,
        color: "danger",
        replace: true,
      });
    }
  });
  document.getElementById("share-room").addEventListener("click", shareRoom);
  document.getElementById("show-qr").addEventListener("click", showQrCode);
  document.getElementById("new-room").addEventListener("click", newRoom);
  document.getElementById("delete-room").addEventListener("click", deleteRoom);
  roomSelect.addEventListener("change", () => {
    const id = roomSelect[roomSelect.selectedIndex].id;
    if (id === "_new_view") newRoom();
    else if (id === "_clear_view") deleteRoom();
    else if (UUID_V4.test(id)) navigateToRoom(id);
  });
  window.addEventListener("hashchange", () => connectRoom());
  window.addEventListener("offline", () =>
    setStatus("Offline — changes saved locally", "offline"),
  );
  window.addEventListener("online", () => {
    if (deliberatelyDeleted) return;
    setStatus("Reconnecting…", "connecting");
    scheduleRemoteWrite(currentState(), 0);
  });
  window.addEventListener("resize", () => {
    for (const item of document.querySelectorAll(".item"))
      keepItemInBounds(item, Number(item.dataset.x), Number(item.dataset.y));
  });

  connectRoom();
  return {
    deleteRoom,
    destroy: () => unsubscribe?.(),
    newRoom,
    roomId: () => roomId,
    save,
  };
}
