import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

const qs = (id) => document.getElementById(id);
const ui = {
  list: qs("service-list"),
  samples: qs("samples"),
  prompt: qs("prompt-input"),
  form: qs("chat-form"),
  log: qs("chat-log"),
  loading: qs("loading"),
  loadingMsg: qs("loading-msg"),
  configBtn: qs("openai-config-btn"),
  exportBtn: qs("export-btn"),
};

let services = [];
let messages = [];
let loadingTimer;

function startLoading() {
  ui.loadingMsg.textContent = "Thinking...";
  ui.loading.classList.remove("d-none");
  loadingTimer = setInterval(() => (ui.loadingMsg.textContent = "Thinking..."), 5000);
}

function stopLoading() {
  clearInterval(loadingTimer);
  ui.loading.classList.add("d-none");
}

const TOOL = {
  type: "function",
  function: {
    name: "select_services",
    description: "Choose AWS services for the given requirements and explain",
    parameters: {
      type: "object",
      properties: {
        services: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Service name" },
              rationale: { type: "string", description: "Why this service" },
            },
            required: ["name", "rationale"],
          },
        },
      },
      required: ["services"],
    },
  },
};

function renderServices() {
  const order = (s) => {
    if (s.ai && s.user) return 1;
    if (s.user && !s.ai) return 2;
    if (s.ai && !s.user) return 3;
    return 4;
  };
  ui.list.replaceChildren();
  services
    .slice()
    .sort((a, b) => order(a) - order(b))
    .forEach((s) => {
      const cls =
        s.ai && s.user
          ? "border-primary bg-primary-subtle"
          : s.user && !s.ai
            ? "border-success bg-success-subtle"
            : s.ai && !s.user
              ? "border-warning"
              : "";
      ui.list.insertAdjacentHTML(
        "beforeend",
        `<div class="col service" data-name="${s.name}">
          <div class="card h-100 ${cls}">
            <div class="card-body">
              <h6 class="card-title">${s.name}</h6>
              <p class="small text-muted mb-1">${s.description}</p>
              <div class="rationale small text-success">${s.rationale || ""}</div>
            </div>
          </div>
        </div>`,
      );
    });
}

function highlightSelections(selected) {
  const map = new Map(selected.map((s) => [s.name, s.rationale]));
  services.forEach((s) => {
    s.ai = map.has(s.name);
    if (s.ai) s.rationale = map.get(s.name);
  });
  renderServices();
}

function addUser(text) {
  ui.log.insertAdjacentHTML("beforeend", `<div class="card mb-2 user"><div class="card-body p-2">${text}</div></div>`);
}

function addAI(selected) {
  const items = selected.map((s) => `<li>${s.name}: ${s.rationale}</li>`).join("");
  ui.log.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-2 ai"><div class="card-body p-2"><ul>${items}</ul></div></div>`,
  );
  ui.log.scrollTop = ui.log.scrollHeight;
}

async function chat(prompt) {
  messages.push({ role: "user", content: prompt });
  const { apiKey, baseUrl } = await openaiConfig({
    defaultBaseUrls: DEFAULT_BASE_URLS,
    help: openaiHelp,
  });
  if (!apiKey)
    return bootstrapAlert({
      title: "OpenAI key missing",
      body: "Configure your key",
      color: "warning",
    });
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "select_services" } },
    }),
  });
  if (!resp.ok) {
    bootstrapAlert({
      title: "API error",
      body: `${resp.status}: ${await resp.text()}`,
      color: "danger",
    });
    messages.pop();
    return null;
  }
  const data = await resp.json();
  const fc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!fc) {
    bootstrapAlert({
      title: "Response error",
      body: "No function call",
      color: "danger",
    });
    messages.pop();
    return null;
  }
  const args = JSON.parse(fc.function.arguments);
  messages.push({ role: "assistant", tool_calls: [fc] });
  messages.push({
    role: "tool",
    tool_call_id: fc.id,
    name: "select_services",
    content: JSON.stringify(args),
  });
  return args.services;
}

ui.configBtn.addEventListener("click", async () => {
  await openaiConfig({
    defaultBaseUrls: DEFAULT_BASE_URLS,
    show: true,
    help: openaiHelp,
  });
});

ui.list.addEventListener("click", (e) => {
  const el = e.target.closest(".service");
  if (!el) return;
  const svc = services.find((s) => s.name === el.dataset.name);
  svc.user = !svc.user;
  renderServices();
});

ui.exportBtn.addEventListener("click", () => {
  const sel = services
    .filter((s) => s.ai || s.user)
    .map((s) => ({
      name: s.name,
      description: s.description,
      rationale: s.rationale || (s.user && !s.ai ? "Selected by user" : ""),
      selected: s.ai || s.user,
    }));
  const blob = new Blob([JSON.stringify({ services: sel }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "services.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

ui.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = ui.prompt.value.trim();
  if (!prompt) return;
  addUser(prompt);
  ui.prompt.value = "";
  startLoading();
  try {
    const selected = await chat(prompt);
    if (selected) {
      addAI(selected);
      highlightSelections(selected);
    }
  } catch (err) {
    bootstrapAlert({ title: "Chat error", body: err.message, color: "danger" });
  } finally {
    stopLoading();
  }
});

ui.samples.addEventListener("click", (e) => {
  const btn = e.target.closest("button.sample");
  if (!btn) return;
  ui.prompt.value = btn.dataset.req;
});

fetch("config.json")
  .then((r) => r.json())
  .then((data) => {
    services = data.services.map((s) => ({
      ...s,
      ai: false,
      user: false,
      rationale: "",
    }));
    renderServices();
    messages = [
      {
        role: "system",
        content: `You are an AWS architect. Select services from this list: ${JSON.stringify(services)}. Return your answer using the select_services function.`,
      },
    ];
    data.samples.forEach(({ title, requirements }) => {
      ui.samples.insertAdjacentHTML(
        "beforeend",
        `<button class="btn btn-outline-secondary btn-sm sample me-1 mb-1" data-req="${requirements}">${title}</button>`,
      );
    });
  })
  .catch((err) =>
    bootstrapAlert({
      title: "Config error",
      body: err.message,
      color: "danger",
    }),
  );
