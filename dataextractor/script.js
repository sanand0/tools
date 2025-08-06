import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { objectsToCsv, csvToTable, downloadCsv } from "../common/csv.js";

const qs = (id) => document.getElementById(id);
const ui = {
  form: qs("dataextractor-form"),
  file: qs("image-input"),
  out: qs("output"),
  loading: qs("loading"),
  configBtn: qs("openai-config-btn"),
  download: qs("download-btn"),
};

let config = { defaultBaseUrls: [] };
fetch("config.json")
  .then((r) => r.json())
  .then((c) => (config = c));

ui.configBtn.addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: config.defaultBaseUrls, show: true, help: openaiHelp });
});

ui.form.addEventListener("submit", extract);

const cols = ["company", "date", "period", "fact", "value", "units", "comments"];
const prompt = () =>
  `From the image extract rows of {${cols.join(",")}}. Company from context or "unknown". Unknown fields empty. Return {"data": [...]}.`;
const fields = () => cols.reduce((o, k) => ((o[k] = { type: "string" }), o), {});

async function extract(e) {
  e.preventDefault();
  const file = ui.file.files[0];
  if (!file) return bootstrapAlert({ title: "Image missing", body: "Upload an image", color: "warning" });

  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: config.defaultBaseUrls, help: openaiHelp });
  if (!apiKey) return bootstrapAlert({ title: "API key", body: "Configure OpenAI key", color: "warning" });

  ui.loading.classList.remove("d-none");
  ui.out.innerHTML = "";
  ui.download.classList.add("d-none");

  const dataUrl = await fileToDataUrl(file);
  const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");

  let text = "";
  const schema = {
    type: "object",
    properties: { data: { type: "array", items: { type: "object", properties: fields(), required: cols } } },
    required: ["data"],
  };
  for await (const { content, error } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt() },
            { type: "input_image", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "dataextractor", schema } },
    }),
  })) {
    if (error) return done(`API error: ${error}`);
    text = content ?? "";
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
  if (msg) bootstrapAlert({ title: "Error", body: msg, color: "danger" });
}
