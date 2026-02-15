const { providers, storageKey, defaultProvider } = window.askai;
const questionInput = document.getElementById("question");
const status = document.getElementById("status");

const pickProvider = (provider) =>
  providers[provider] ? provider : defaultProvider;
const toUrl = (provider, question) =>
  providers[provider].replace("%s", encodeURIComponent(question));
const showProvider = (provider) => {
  document.querySelectorAll("[data-ai]").forEach((button) => {
    const active = button.dataset.ai === provider;
    button.classList.toggle("btn-primary", active);
    button.classList.toggle("btn-outline-primary", !active);
  });
};
const navigate = (url) => {
  if (window.location.hostname === "test") {
    window.__askaiRedirectTarget = url;
    return;
  }
  window.location.href = url;
};

function ask(provider) {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  const resolvedProvider = pickProvider(provider);
  localStorage.setItem(storageKey, resolvedProvider);
  showProvider(resolvedProvider);
  status.textContent = `Opening ${resolvedProvider}...`;
  navigate(toUrl(resolvedProvider, question));
}

document.querySelectorAll("[data-ai]").forEach((button) => {
  button.addEventListener("click", () => ask(button.dataset.ai));
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

const preferredProvider = pickProvider(localStorage.getItem(storageKey));
showProvider(preferredProvider);
document.querySelector(`[data-ai="${preferredProvider}"]`)?.focus();
