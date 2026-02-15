const providers = {
  chatgpt: "https://chatgpt.com/?q=%s",
  claude: "https://claude.ai/new?q=%s",
  grok: "https://grok.com/?q=%s",
  perplexity: "https://www.perplexity.ai/search?q=%s",
  google: "https://www.google.com/search?udm=50&q=%s",
};

const storageKey = "askai:lastProvider";
const questionInput = document.getElementById("question");
const status = document.getElementById("status");

function buildProviderUrl(provider, question) {
  return providers[provider].replace("%s", encodeURIComponent(question));
}

function getPreferredProvider() {
  const provider = localStorage.getItem(storageKey);
  return providers[provider] ? provider : "chatgpt";
}

function navigateTo(url) {
  if (window.location.hostname === "test") {
    window.__askaiRedirectTarget = url;
    return;
  }
  window.location.href = url;
}

function ask(provider) {
  const question = questionInput.value.trim();
  if (!question) {
    status.textContent = "Type a question first.";
    return;
  }

  localStorage.setItem(storageKey, provider);
  status.textContent = `Opening ${provider}...`;
  navigateTo(buildProviderUrl(provider, question));
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
const preferredButton = document.querySelector(
  `[data-ai="${preferredProvider}"]`,
);
if (preferredButton) {
  preferredButton.focus();
}
