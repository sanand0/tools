const { providers, storageKey, defaultProvider } = window.askai;
const questionInput = document.getElementById("question");
const status = document.getElementById("status");

const pickProvider = (provider) => (providers[provider] ? provider : defaultProvider);
let selectedProvider = pickProvider(localStorage.getItem(storageKey));
const showProvider = (provider) => {
  document.querySelectorAll("[data-ai]").forEach((button) => {
    const active = button.dataset.ai === provider;
    button.classList.toggle("btn-primary", active);
    button.classList.toggle("btn-outline-primary", !active);
  });
};
const openInNewTab = (url) => {
  if (window.location.hostname === "test") {
    window.__askaiOpenTarget = url;
    return;
  }
  window.open(url, "_blank", "noopener");
};

function selectProvider(provider) {
  const resolvedProvider = pickProvider(provider);
  selectedProvider = resolvedProvider;
  localStorage.setItem(storageKey, resolvedProvider);
  showProvider(resolvedProvider);
  status.textContent = `Selected ${resolvedProvider}.`;
}

function buildShareUrl(question) {
  const shareUrl = new URL(window.location.href);
  shareUrl.search = "";
  shareUrl.searchParams.set("q", question);
  shareUrl.searchParams.set("ai", selectedProvider);
  return shareUrl.toString();
}

document.querySelectorAll("[data-ai]").forEach((button) => {
  button.addEventListener("click", () => selectProvider(button.dataset.ai));
});

document.getElementById("copy-link").addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  try {
    await navigator.clipboard.writeText(buildShareUrl(question));
    status.textContent = "Link copied.";
  } catch {
    status.textContent = "Could not copy link.";
  }
});

document.getElementById("open-link").addEventListener("click", () => {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  openInNewTab(buildShareUrl(question));
  status.textContent = "Link opened.";
});

showProvider(selectedProvider);
document.querySelector(`[data-ai="${selectedProvider}"]`)?.focus();
