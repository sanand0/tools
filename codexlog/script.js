import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";
import { copyText } from "../common/clipboard-utils.js";
import { downloadBlob } from "../common/download.js";
import { loadConfigJson, readParam } from "../common/demo.js";

const ui = {
  alertContainer: document.getElementById("alertContainer"),
  sampleContainer: document.getElementById("sampleContainer"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  spinner: document.getElementById("loadingSpinner"),
  preview: document.getElementById("markdownPreview"),
  copy: document.getElementById("copyButton"),
  download: document.getElementById("downloadButton"),
};

let currentMarkdown = "";
let currentFilename = "session.md";
let sampleConfig = null;

const alert = (options) =>
  bootstrapAlert({
    container: ui.alertContainer ?? undefined,
    replace: true,
    ...options,
  });

const setLoading = (loading) => ui.spinner.classList.toggle("d-none", !loading);
const resetOutput = () => {
  currentMarkdown = "";
  showPlaceholder();
  ui.copy.disabled = true;
  ui.download.disabled = true;
  ui.copy.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy Markdown`;
};

const renderSamples = (samples) => {
  if (!ui.sampleContainer) return;
  if (!Array.isArray(samples) || !samples.length) {
    ui.sampleContainer.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  ui.sampleContainer.replaceChildren(
    label,
    ...samples.map((sample) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = sample.name || sample.id;
      button.addEventListener("click", () => void loadSample(sample.id));
      return button;
    }),
  );
};

const safeJson = (value) => {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const codeBlock = (lang, body = "") => `\`\`\`${lang}\n${body ?? ""}\n\`\`\`\n`;
const heading = (title) => `\n\n## ${title}\n\n`;
const details = (summary, body, open = false) => `\n\n<details${open ? " open" : ""}>${summary}${body}\n\n</details>`;
const summary = (title) => `<summary><strong>${title}</strong></summary>\n\n`;

const showPlaceholder = () => {
  if (!ui.preview) return;
  const placeholder = document.createElement("p");
  placeholder.className = "text-secondary m-0";
  placeholder.textContent = "Converted Markdown preview will appear here…";
  ui.preview.replaceChildren(placeholder);
};

const renderPreview = (markdown) => {
  if (!ui.preview) return;
  try {
    if (marked?.parse && DOMPurify?.sanitize) {
      const html = DOMPurify.sanitize(marked.parse(markdown));
      const wrapper = document.createElement("div");
      wrapper.className = "markdown-preview";
      wrapper.innerHTML = html;
      ui.preview.replaceChildren(wrapper);
      return;
    }
  } catch {
    // Fall back to a plain-text preview.
  }
  const pre = document.createElement("pre");
  pre.className = "m-0";
  pre.textContent = markdown;
  ui.preview.replaceChildren(pre);
};

const firstSummaryText = (summaryItems) => {
  if (!Array.isArray(summaryItems)) return "";
  const item = summaryItems.find((entry) => typeof entry?.text === "string");
  return item?.text ?? "";
};

const parseEntry = (entry) => {
  const payload = entry?.payload ?? {};
  const type = payload.type ?? entry?.type;
  const message = payload.message ?? "";

  switch (type) {
    case "user_message":
    case "agent_message":
      return heading(type) + message;
    case "agent_reasoning": {
      const body = payload.text ?? payload.message ?? "";
      return details(summary("agent reasoning"), body, true);
    }
    case "reasoning": {
      const text = firstSummaryText(payload.summary);
      return details(summary("reasoning"), text, true);
    }
    case "function_call": {
      const args = safeJson(payload.arguments) || {};
      let body = "";
      if (Array.isArray(args.command) && args.command.length) {
        body = codeBlock("bash", args.command.join(" "));
      } else if (typeof args.command === "string" && args.command.trim()) {
        body = codeBlock("bash", args.command.trim());
      }
      return details(summary(`tool: ${payload.name ?? ""}`), body);
    }
    case "function_call_output": {
      const parsed = safeJson(payload.output) || {};
      const metadata = parsed.metadata ?? {};
      const exitCode = metadata.exit_code ?? "unknown";
      const duration = metadata.duration_seconds ?? "unknown";
      const metaLine =
        metadata && (metadata.exit_code !== undefined || metadata.duration_seconds !== undefined)
          ? `**exit:** ${exitCode} · **duration:** ${duration}s\n`
          : "";
      const outputText =
        typeof parsed.output === "string" ? parsed.output : typeof payload.output === "string" ? payload.output : "";
      const body = `${metaLine}${codeBlock("txt", outputText)}`;
      return details(summary("tool output"), body);
    }
    default:
      return "";
  }
};

const convertToMarkdown = (text) => {
  const lines = text.split(/\r?\n/);
  const parts = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      throw new Error(`Line ${index + 1} is not valid JSON: ${error.message}`);
    }
    const block = parseEntry(entry);
    if (block) parts.push(block);
  });
  return parts.join("").replace(/^\s+/, "");
};

const loadSample = async (id) => {
  if (!sampleConfig?.samples?.length) return;
  const sample = sampleConfig.samples.find((item) => item.id === id);
  if (!sample?.path) return;
  resetOutput();
  setLoading(true);
  try {
    const response = await fetch(sample.path);
    if (!response.ok) throw new Error(`Failed to load ${sample.path}: HTTP ${response.status}`);
    const text = await response.text();
    const markdown = convertToMarkdown(text);
    currentMarkdown = markdown;
    currentFilename = `${sample.id}.md`;
    renderPreview(markdown);
    ui.copy.disabled = false;
    ui.download.disabled = false;
  } catch (error) {
    alert({ title: "Sample load failed", body: error.message, color: "danger" });
  } finally {
    setLoading(false);
  }
};

const handleFile = async (file) => {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".jsonl")) {
    alert({ title: "Unsupported file", body: "Please choose a .jsonl Codex session log.", color: "warning" });
    return;
  }
  resetOutput();
  setLoading(true);
  try {
    const text = await file.text();
    if (!text.trim()) {
      alert({ title: "Empty file", body: "The selected log file has no events.", color: "warning" });
      return;
    }
    const markdown = convertToMarkdown(text);
    if (!markdown.trim()) {
      alert({ title: "No events", body: "The log did not contain recognised Codex events.", color: "warning" });
      return;
    }
    currentMarkdown = markdown;
    currentFilename = file.name.replace(/\.jsonl$/i, ".md");
    renderPreview(markdown);
    ui.copy.disabled = false;
    ui.download.disabled = false;
  } catch (error) {
    alert({ title: "Conversion failed", body: error.message, color: "danger" });
  } finally {
    setLoading(false);
    if (ui.fileInput) ui.fileInput.value = "";
  }
};

async function initSamples() {
  try {
    sampleConfig = await loadConfigJson("config.json");
    renderSamples(sampleConfig.samples);
    const sampleId = readParam("log", { fallback: "" });
    if (sampleId) void loadSample(sampleId);
  } catch (error) {
    alert({ title: "Config error", body: error.message, color: "danger" });
  }
}

ui.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  ui.dropZone.classList.add("dragover");
});

ui.dropZone.addEventListener("dragleave", () => ui.dropZone.classList.remove("dragover"));

ui.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  ui.dropZone.classList.remove("dragover");
  const [file] = Array.from(event.dataTransfer.files);
  void handleFile(file);
});

ui.fileInput.addEventListener("change", () => {
  const [file] = Array.from(ui.fileInput.files ?? []);
  void handleFile(file);
});

ui.copy.addEventListener("click", async () => {
  if (!currentMarkdown) return;
  const copied = await copyText(currentMarkdown);
  if (!copied) {
    alert({ title: "Copy failed", body: "Unable to copy Markdown to the clipboard.", color: "danger" });
    return;
  }
  ui.copy.innerHTML = `<i class="bi bi-check2-circle me-1"></i>Copied!`;
  setTimeout(() => (ui.copy.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy Markdown`), 2000);
});

ui.download.addEventListener("click", () => {
  if (!currentMarkdown) return;
  const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, currentFilename);
});

void initSamples();

showPlaceholder();
