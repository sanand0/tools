import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";

const input = document.getElementById("input");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const formatSelect = document.getElementById("format-select");
saveform("#excelconvert-form");

const converters = {
  jsonl: (rows) => rows.map((r) => JSON.stringify(r)).join("\n"),
  yaml: (rows) =>
    rows
      .map(
        (r) =>
          "- " +
          Object.entries(r)
            .map(([k, v], i) => (i ? `\n  ${k}: ${v}` : `${k}: ${v}`))
            .join(""),
      )
      .join("\n"),
  xml: (rows) =>
    `<rows>\n${rows
      .map(
        (r) =>
          `  <row>\n${Object.entries(r)
            .map(([k, v]) => `    <${k}>${v}</${k}>`)
            .join("\n")}\n  </row>`,
      )
      .join("\n")}\n</rows>`,
  toml: (rows) =>
    rows
      .map(
        (r) =>
          `[[rows]]\n${Object.entries(r)
            .map(([k, v]) => `${k} = "${v}"`)
            .join("\n")}`,
      )
      .join("\n\n"),
};

function updateDownloadButton() {
  downloadBtn.disabled = output.value.trim() === "";
}

function convert() {
  const text = input.value.trim();
  if (!text) {
    output.value = "";
    updateDownloadButton();
    return;
  }
  try {
    const rows = dsvFormat("\t").parse(text);
    output.value = converters[formatSelect.value](rows);
  } catch (error) {
    output.value = "";
    bootstrapAlert(error.message, "danger");
  }
  updateDownloadButton();
}

input.addEventListener("input", convert);
formatSelect.addEventListener("change", convert);

copyBtn.addEventListener("click", async () => {
  await copyText(output.value);
  bootstrapAlert("Copied to clipboard!");
});

downloadBtn.addEventListener("click", () => {
  const ext = { jsonl: "jsonl", yaml: "yaml", xml: "xml", toml: "toml" }[formatSelect.value];
  const blob = new Blob([output.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  document.body.insertAdjacentHTML("beforeend", `<a href="${url}" download="data.${ext}"></a>`);
  const a = document.body.lastElementChild;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

updateDownloadButton();
