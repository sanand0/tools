const readClipboardBtn = document.getElementById("readClipboard");
const charContainer = document.getElementById("charContainer");
const spinner = document.getElementById("spinner");
const errorToast = new bootstrap.Toast(document.getElementById("errorToast"));
const readTextBtn = document.getElementById("readText");
const textInput = document.getElementById("textInput");

function showError(message) {
  document.querySelector("#errorToast .toast-body").textContent = message;
  errorToast.show();
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
  button.innerHTML = `
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
  charContainer.innerHTML = "";

  if (nonAsciiChars.length === 0) {
    charContainer.innerHTML = '<p class="text-muted">No non-ASCII characters found.</p>';
    return;
  }

  nonAsciiChars.forEach((char) => {
    charContainer.appendChild(createCharacterButton(char));
  });
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
