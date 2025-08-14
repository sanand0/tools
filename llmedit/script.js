import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import DiffMatchPatch from "https://cdn.jsdelivr.net/npm/diff-match-patch@1/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";

const qs = (id) => document.getElementById(id);
const ui = {
  form: qs("llmedit-form"),
  prompt: qs("prompt-input"),
  doc: qs("doc-area"),
  loading: qs("loading"),
  configBtn: qs("openai-config-btn"),
};

saveform("#llmedit-form");
const dmp = new DiffMatchPatch();

ui.configBtn.addEventListener("click", () => openaiConfig({ show: true }));

ui.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const p = ui.prompt.value.trim();
  if (!p) return bootstrapAlert({ title: "Prompt missing", body: "Enter instructions", color: "warning" });
  const { apiKey, baseUrl } = await openaiConfig({});
  if (!apiKey) return bootstrapAlert({ title: "API key", body: "Configure OpenAI", color: "warning" });
  const doc = ui.doc.value;
  ui.loading.classList.remove("d-none");
  let diffText = "";
  const messages = [
    { role: "system", content: "Edit the document per instruction and return diff-match-patch text" },
    { role: "user", content: `Document:\n${doc}\n\nInstruction:\n${p}` },
  ];
  for await (const { content, error } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4.1-mini", messages }),
  })) {
    if (error) {
      ui.loading.classList.add("d-none");
      return bootstrapAlert({ title: "API error", body: error, color: "danger" });
    }
    diffText = content || "";
  }
  ui.loading.classList.add("d-none");
  try {
    const patches = dmp.patch_fromText(diffText);
    const [res, ok] = dmp.patch_apply(patches, doc);
    if (ok.some((v) => !v)) throw new Error("Patch mismatch");
    ui.doc.value = res;
  } catch (err) {
    bootstrapAlert({ title: "Patch error", body: err.message, color: "danger" });
  }
});
