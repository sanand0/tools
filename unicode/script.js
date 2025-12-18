import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { readParam } from "../common/demo.js";
const readClipboardBtn = document.getElementById("readClipboard");
const charContainer = document.getElementById("charContainer");
const spinner = document.getElementById("spinner");
const readTextBtn = document.getElementById("readText");
const textInput = document.getElementById("textInput");
const sampleContainer = document.getElementById("sampleContainer");
saveform("#unicode-form");

function showError(message) {
  bootstrapAlert({ title: "Input error", body: message, color: "danger", replace: true });
}

function getNonAsciiChars(text) {
  const chars = new Set();
  for (let char of text) {
    if (char.charCodeAt(0) > 127) {
      chars.add(char);
    }
  }
  return Array.from(chars);
}

function createCharacterButton(char) {
  const codePoint = char.codePointAt(0);
  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
  const decimal = codePoint;

  const button = document.createElement("button");
  button.className = "btn btn-outline-secondary char-btn";
  button.innerHTML = /* html */ `
        <div class="char-display">${char}</div>
        <div class="text-muted">
          <div class="hex-value">U+${hex}</div>
          <small>DEC: ${decimal}</small>
        </div>
      `;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(char);
      button.classList.add("btn-success");
      setTimeout(() => button.classList.remove("btn-success"), 500);
    } catch (error) {
      showError("Failed to copy to clipboard");
      console.error("Copy error:", error);
    }
  });

  return button;
}

function processText(text) {
  const nonAsciiChars = getNonAsciiChars(text);
  charContainer.replaceChildren();

  if (nonAsciiChars.length === 0) {
    const message = document.createElement("p");
    message.className = "text-muted";
    message.textContent = "No non-ASCII characters found.";
    charContainer.replaceChildren(message);
    return;
  }

  charContainer.replaceChildren(...nonAsciiChars.map((char) => createCharacterButton(char)));
}

readTextBtn.addEventListener("click", () => {
  processText(textInput.value);
});

readClipboardBtn.addEventListener("click", async () => {
  try {
    spinner.classList.remove("d-none");
    readClipboardBtn.disabled = true;

    const text = await navigator.clipboard.readText();
    processText(text);
  } catch (error) {
    showError("Failed to read clipboard. Please ensure you have granted clipboard permission.");
    console.error("Clipboard error:", error);
  } finally {
    spinner.classList.add("d-none");
    readClipboardBtn.disabled = false;
  }
});

const samples = [
  { id: "emoji", name: "Emoji + Greek", text: "Hello 😊 World αβγ" },
  { id: "accents", name: "Accents", text: "Café Noël — déjà vu" },
  { id: "math", name: "Math symbols", text: "∑ √ π ≈ 3.14159" },
];

function renderSamples() {
  if (!sampleContainer) return;
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  sampleContainer.replaceChildren(
    label,
    ...samples.map((sample) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = sample.name;
      button.addEventListener("click", () => {
        textInput.value = sample.text;
        processText(sample.text);
      });
      return button;
    }),
  );
}

renderSamples();

const urlText = readParam("text", { fallback: "" });
if (urlText) {
  textInput.value = urlText;
  processText(urlText);
} else if (!textInput.value.trim()) {
  textInput.value = samples[0].text;
}
