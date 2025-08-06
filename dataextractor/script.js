import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { objectsToCsv, csvToTable, downloadCsv } from "../common/csv.js";

const qs = (id) => document.getElementById(id);
const ui = {
  form: qs("dataextractor-form"),
  file: qs("image-input"),
  sys: qs("system-prompt"),
  cols: qs("cols-input"),
  model: qs("model-select"),
  out: qs("output"),
  loading: qs("loading"),
  progress: qs("progress"),
  configBtn: qs("openai-config-btn"),
  download: qs("download-btn"),
};

let cfg = { defaultBaseUrls: [] };
fetch("config.json")
  .then((r) => r.json())
  .then((c) => {
    cfg = c;
    configure();
  });

ui.configBtn.addEventListener("click", () => configure(true));
ui.form.addEventListener("submit", extract);

const defaultCols = "company,date,period,fact,value,units,comments";
ui.cols.value = defaultCols;
ui.sys.value = `From the image extract rows of {${defaultCols}}. Company from context or "unknown". Unknown fields empty. Return {"data":[...]}.`;

let creds = {};
async function configure(show = false) {
  const c = await openaiConfig({ defaultBaseUrls: cfg.defaultBaseUrls, help: openaiHelp, show });
  if (!c.apiKey) return c;
  creds = c;
  if (!ui.model.options.length || show) await loadModels();
  return c;
}

async function loadModels() {
  const url = creds.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${url}/models`, { headers: { Authorization: `Bearer ${creds.apiKey}` } });
  const { data = [] } = await res.json();
  data.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  ui.model.innerHTML = data.map((m) => `<option value="${m.id}">${m.id}</option>`).join("");
  ui.model.value = data.find((m) => m.id === "gpt-4.1-mini") ? "gpt-4.1-mini" : data[0]?.id || "";
}

const colsList = () =>
  ui.cols.value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
const prompt = (cols) =>
  `From the image extract rows of {${cols.join(",")}}. Company from context or "unknown". Unknown fields empty. Return {"data":[...]}.`;
const fields = (cols) => cols.reduce((o, k) => ((o[k] = { type: "string" }), o), {});

async function extract(e) {
  e.preventDefault();
  const file = ui.file.files[0];
  if (!file) return bootstrapAlert({ title: "Image missing", body: "Upload an image", color: "warning" });

  const { apiKey, baseUrl } = await configure();
  if (!apiKey) return bootstrapAlert({ title: "API key", body: "Configure OpenAI key", color: "warning" });

  const cols = colsList();
  const first = cols[0];

  ui.loading.classList.remove("d-none");
  ui.progress.textContent = "0 facts extracted";
  ui.out.replaceChildren();
  ui.download.classList.add("d-none");

  const dataUrl = await fileToDataUrl(file);
  const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");

  let text = "";
  const schema = {
    type: "object",
    properties: { data: { type: "array", items: { type: "object", properties: fields(cols), required: cols } } },
    required: ["data"],
  };
  const messages = [
    { role: "system", content: ui.sys.value },
    {
      role: "user",
      content: [
        { type: "text", text: prompt(cols) },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ];
  for await (const { content, error } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: ui.model.value,
      stream: true,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "dataextractor", schema } },
    }),
  })) {
    if (error) return done(`API error: ${error}`);
    text = content ?? "";
    const count = (text.match(new RegExp(`"${first}"`, "g")) || []).length;
    ui.progress.textContent = `${count} facts extracted`;
  }

  try {
    const data = JSON.parse(text).data;
    const csv = objectsToCsv(data);
    csvToTable(ui.out, csv);
    ui.download.onclick = () => downloadCsv(csv, "data.csv");
    ui.download.classList.remove("d-none");
  } catch {
    return done("Bad JSON from model");
  }
  done();
}

const fileToDataUrl = (f) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(f);
  });

function done(msg) {
  ui.loading.classList.add("d-none");
  ui.progress.textContent = "";
  if (msg) bootstrapAlert({ title: "Error", body: msg, color: "danger" });
}
