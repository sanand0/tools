const {
  providers = {},
  storageKey = "askai:lastProvider",
  defaultProvider = "google",
} = window.__askaiConfig || {};
const questionInput = document.getElementById("question");
const status = document.getElementById("status");

function normalizeProvider(provider) {
  return providers[provider] ? provider : defaultProvider;
}

function buildProviderUrl(provider, question) {
  return providers[normalizeProvider(provider)].replace(
    "%s",
    encodeURIComponent(question),
  );
}

function getPreferredProvider() {
  const provider = localStorage.getItem(storageKey);
  return normalizeProvider(provider);
}

function navigateTo(url) {
  if (window.location.hostname === "test") {
    window.__askaiRedirectTarget = url;
    return;
  }
  window.location.href = url;
}

function setPreferredButton(provider) {
  document.querySelectorAll("[data-ai]").forEach((button) => {
    button.classList.remove("btn-primary");
    button.classList.add("btn-outline-primary");
  });

  const preferredButton = document.querySelector(
    `[data-ai="${normalizeProvider(provider)}"]`,
  );
  if (!preferredButton) return;

  preferredButton.classList.remove("btn-outline-primary");
  preferredButton.classList.add("btn-primary");
}

function ask(provider) {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  const normalizedProvider = normalizeProvider(provider);
  localStorage.setItem(storageKey, normalizedProvider);
  setPreferredButton(normalizedProvider);
  status.textContent = `Opening ${normalizedProvider}...`;
  navigateTo(buildProviderUrl(normalizedProvider, question));
}

document.querySelectorAll("[data-ai]").forEach((button) => {
  button.addEventListener("click", () => {
    ask(button.dataset.ai);
  });
});

document.getElementById("copy-link").addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  const shareUrl = new URL(window.location.href);
  shareUrl.search = "";
  shareUrl.searchParams.set("q", question);

  try {
    await navigator.clipboard.writeText(shareUrl.toString());
    status.textContent = "Link copied.";
  } catch {
    status.textContent = "Could not copy link.";
  }
});

const preferredProvider = getPreferredProvider();
setPreferredButton(preferredProvider);
document.querySelector(`[data-ai="${preferredProvider}"]`)?.focus();
