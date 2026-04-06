// @ts-check
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const PROMPT_TEMPLATE = `Search online and build a **COMPREHENSIVE** public dossier on:

Name: $NAME
Role: $ROLE

Structure it as:

1. Career Timeline — Every posting and tenure you can find, with source and year. Flag any gaps.
2. Public Record — All public forums mentioning them, regulatory filings, court cases, audit observations, company directorships, government notifications, or institutional affiliations.
3. Media Presence — Notable speeches, interviews, quotes attributed to them.
4. Contradictions — Any case where two sources give conflicting facts about the same event, posting, or date. List each conflict explicitly.
5. Probable Errors — Claims that appear factually wrong based on cross-referencing. Explain why.
6. Confidence Rating — For each section, rate how complete you think your information is (High / Medium / Low) and why.

Be specific. Use web search. Cite sources. If you're uncertain, say so.`;

const providers = {
  chatgpt: {
    buttonId: "chatgpt-button",
    label: "ChatGPT",
    url: "https://chatgpt.com/?q=%s&model=gpt-5.4",
  },
  claude: {
    buttonId: "claude-button",
    label: "Claude",
    url: "https://claude.ai/new?q=%s&model=claude-sonnet-4.6",
  },
};

const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById("name-input"));
const roleInput = /** @type {HTMLInputElement | null} */ (document.getElementById("role-input"));
const status = document.getElementById("launch-status");
const formSelector = "#researchme-form";

if (!nameInput || !roleInput || !status) throw new Error("Research Me UI did not load correctly.");

saveform(formSelector);

const buttons = Object.fromEntries(
  Object.entries(providers).map(([key, provider]) => {
    const button = /** @type {HTMLButtonElement | null} */ (document.getElementById(provider.buttonId));
    if (!button) throw new Error(`Missing button for ${provider.label}.`);
    return [key, button];
  }),
);

const readFields = () => ({
  name: nameInput.value.trim(),
  role: roleInput.value.trim(),
});

const isReady = () => {
  const { name, role } = readFields();
  return Boolean(name && role);
};

const buildPrompt = () => {
  const { name, role } = readFields();
  return PROMPT_TEMPLATE.replace("$NAME", name).replace("$ROLE", role);
};

const buildUrl = (providerKey) => providers[providerKey].url.replace("%s", encodeURIComponent(buildPrompt()));

const syncButtons = () => {
  const ready = isReady();
  Object.values(buttons).forEach((button) => {
    button.disabled = !ready;
  });

  status.textContent = ready
    ? "Ready. Pick a provider to open your pre-filled dossier prompt."
    : "Add both fields to unlock the launch buttons.";
};

const openProvider = (providerKey) => {
  if (!isReady()) return;

  const target = buildUrl(providerKey);
  if (window.location.hostname === "test") {
    window.__researchmeRedirectTarget = target;
    window.__researchmePrompt = buildPrompt();
    return;
  }

  window.open(target, "_blank", "noopener");
};

document.getElementById("researchme-form")?.addEventListener("input", syncButtons);
Object.entries(buttons).forEach(([providerKey, button]) => {
  button.addEventListener("click", () => openProvider(providerKey));
});

syncButtons();
