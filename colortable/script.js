import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import * as chromatic from "https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3/+esm";
import { interpolateRgb } from "https://cdn.jsdelivr.net/npm/d3-interpolate@3/+esm";
import { rgb } from "https://cdn.jsdelivr.net/npm/d3-color@3/+esm";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { copyText } from "../common/clipboard-utils.js";

const $ = (selector, scope = document) => scope.querySelector(selector);

const tableInput = $("#table-input");
const delimiterInput = $("#delimiter-input");
const colorModeSelect = $("#color-mode");
const rangeMinInput = $("#range-min");
const rangeMaxInput = $("#range-max");
const rangeHint = $("#range-hint");
const gradientSelect = $("#gradient-select");
const gradientPreview = $("#gradient-preview");
const reverseScaleInput = $("#reverse-scale");
const customToggle = $("#use-custom-colors");
const lowColorInput = $("#low-color");
const highColorInput = $("#high-color");
const previewContainer = $("#table-preview");
const copyButton = $("#copy-html");
const alertContainer = $("#alert-container");

saveform("#colortable-form");

const gradientGroups = [
  {
    label: "Sequential",
    gradients: [
      ["blues", "Blues", "interpolateBlues"],
      ["greens", "Greens", "interpolateGreens"],
      ["greys", "Greys", "interpolateGreys"],
      ["oranges", "Oranges", "interpolateOranges"],
      ["purples", "Purples", "interpolatePurples"],
      ["reds", "Reds", "interpolateReds"],
      ["turbo", "Turbo", "interpolateTurbo"],
      ["viridis", "Viridis", "interpolateViridis"],
      ["inferno", "Inferno", "interpolateInferno"],
      ["magma", "Magma", "interpolateMagma"],
      ["plasma", "Plasma", "interpolatePlasma"],
      ["cividis", "Cividis", "interpolateCividis"],
      ["warm", "Warm", "interpolateWarm"],
      ["cool", "Cool", "interpolateCool"],
      ["cubehelix", "Cubehelix Default", "interpolateCubehelixDefault"],
      ["bugn", "Blue-Green", "interpolateBuGn"],
      ["bupu", "Blue-Purple", "interpolateBuPu"],
      ["gnbu", "Green-Blue", "interpolateGnBu"],
      ["orrd", "Orange-Red", "interpolateOrRd"],
      ["pubugn", "Purple-Blue-Green", "interpolatePuBuGn"],
      ["pubu", "Purple-Blue", "interpolatePuBu"],
      ["purd", "Purple-Red", "interpolatePuRd"],
      ["rdpu", "Red-Purple", "interpolateRdPu"],
      ["ylgnbu", "Yellow-Green-Blue", "interpolateYlGnBu"],
      ["ylgn", "Yellow-Green", "interpolateYlGn"],
      ["ylorbr", "Yellow-Orange-Brown", "interpolateYlOrBr"],
      ["ylorrd", "Yellow-Orange-Red", "interpolateYlOrRd"],
    ],
  },
  {
    label: "Diverging",
    gradients: [
      ["brbg", "Brown-Blue-Green", "interpolateBrBG"],
      ["prgn", "Purple-Green", "interpolatePRGn"],
      ["piyg", "Pink-Yellow-Green", "interpolatePiYG"],
      ["puor", "Purple-Orange", "interpolatePuOr"],
      ["rdbu", "Red-Blue", "interpolateRdBu"],
      ["rdgy", "Red-Grey", "interpolateRdGy"],
      ["rdylbu", "Red-Yellow-Blue", "interpolateRdYlBu"],
      ["rdylgn", "Red-Yellow-Green", "interpolateRdYlGn"],
      ["spectral", "Spectral", "interpolateSpectral"],
    ],
  },
  {
    label: "Cyclical",
    gradients: [
      ["rainbow", "Rainbow", "interpolateRainbow"],
      ["sinebow", "Sinebow", "interpolateSinebow"],
    ],
  },
];
const gradients = gradientGroups.flatMap((group) =>
  group.gradients.map(([id, label, interpolator]) => ({ id, label, interpolator: chromatic[interpolator] })),
);
const gradientMap = new Map(gradients.map((item) => [item.id, item]));
const defaultGradient = "rdylgn";

let lastAutoRange = { min: null, max: null };
let lastHtml = "";

const alert = (options) =>
  bootstrapAlert({
    container: alertContainer ?? undefined,
    replace: true,
    ...options,
  });

const normalizeDelimiter = (raw) => {
  const value = raw.trim();
  if (!value) return ",";
  const key = value.toLowerCase();
  const alias = {
    tab: "\t",
    "\\t": "\t",
    comma: ",",
    pipe: "|",
    semicolon: ";",
    space: " ",
  };
  if (alias[key]) return alias[key];
  return value[0];
};

const trimCell = (value) => `${value ?? ""}`.trim();

const parseNumericValue = (raw) => {
  const trimmed = trimCell(raw);
  if (!trimmed) return null;
  const isPercent = trimmed.endsWith("%");
  const normalized = trimmed.replace(/,/g, "").replace(/%$/, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return isPercent ? number / 100 : number;
};

const parseAffixedValue = (raw) => {
  const trimmed = trimCell(raw);
  if (!trimmed) return null;
  const match = trimmed.match(/^([^\d+-]*)([-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?)([^\d]*)$/i);
  if (!match) return null;
  const [, prefix, numberText, suffix] = match;
  const number = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  return {
    number: suffix.trim() === "%" ? number / 100 : number,
    prefix,
    suffix,
  };
};

const buildColumnNumericParsers = (rows) => {
  const maxCols = Math.max(0, ...rows.map((row) => row.length));
  return Array.from({ length: maxCols }, (_, colIndex) => {
    const parsed = rows
      .map((row) => ({ raw: trimCell(row[colIndex] ?? ""), parsed: parseAffixedValue(row[colIndex]) }))
      .filter(({ raw }) => raw !== "");
    if (!parsed.length || parsed.some(({ parsed: value }) => value === null)) return () => null;

    const prefixes = new Set(parsed.map(({ parsed: value }) => value.prefix).filter(Boolean));
    const suffixes = new Set(parsed.map(({ parsed: value }) => value.suffix).filter(Boolean));
    if (prefixes.size > 1 || suffixes.size > 1) return () => null;

    const allowedPrefix = prefixes.values().next().value ?? "";
    const allowedSuffix = suffixes.values().next().value ?? "";
    return (raw) => {
      const value = parseAffixedValue(raw);
      if (value === null) return null;
      if (value.prefix && value.prefix !== allowedPrefix) return null;
      if (value.suffix && value.suffix !== allowedSuffix) return null;
      return value.number;
    };
  });
};

const parseRangeInput = (value) => {
  const trimmed = trimCell(value);
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
};

const escapeText = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatTableHtml = (table) => {
  const serialize = (element, depth) => {
    const tag = element.tagName.toLowerCase();
    const indent = "  ".repeat(depth);
    const attrs = [...element.attributes].map((attr) => ` ${attr.name}="${escapeAttribute(attr.value)}"`).join("");
    const children = [...element.children];
    if (!children.length) {
      const text = escapeText(element.textContent ?? "");
      return `${indent}<${tag}${attrs}>${text}</${tag}>`;
    }
    const lines = [`${indent}<${tag}${attrs}>`];
    children.forEach((child) => lines.push(serialize(child, depth + 1)));
    lines.push(`${indent}</${tag}>`);
    return lines.join("\n");
  };
  return serialize(table, 0);
};

const buildScale = (min, max, interpolator) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) return () => interpolator(0.5);
  const span = max - min;
  return (value) => {
    const ratio = Math.min(1, Math.max(0, (value - min) / span));
    return interpolator(reverseScaleInput?.checked ? 1 - ratio : ratio);
  };
};

const buildGradientCss = (interpolator) => {
  const steps = Array.from({ length: 6 }, (_, i) => {
    const ratio = i / 5;
    return rgb(interpolator(reverseScaleInput?.checked ? 1 - ratio : ratio)).formatHex();
  });
  return `linear-gradient(90deg, ${steps.join(", ")})`;
};

const getInterpolator = () => {
  if (customToggle.checked) {
    return interpolateRgb(lowColorInput.value, highColorInput.value);
  }
  const selected = gradientMap.get(gradientSelect.value) ?? gradients[0];
  return selected.interpolator;
};

const getColorMode = () => colorModeSelect?.value || "table";

const renderGradientOptions = () => {
  const selected = gradientSelect.value;
  gradientSelect.replaceChildren(
    ...gradientGroups.map((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      optgroup.replaceChildren(
        ...group.gradients.map(([id, label]) => {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = label;
          return option;
        }),
      );
      return optgroup;
    }),
  );
  gradientSelect.value = gradientMap.has(selected) ? selected : defaultGradient;
};

const updateGradientPreview = () => {
  gradientPreview.style.backgroundImage = buildGradientCss(getInterpolator());
};

const updateCustomInputsState = () => {
  const enabled = customToggle.checked;
  lowColorInput.disabled = !enabled;
  highColorInput.disabled = !enabled;
};

const updateRangeModeState = (mode, autoMin, autoMax) => {
  const isTableMode = mode === "table";
  rangeMinInput.disabled = !isTableMode;
  rangeMaxInput.disabled = !isTableMode;
  if (!rangeHint || isTableMode) return;
  if (Number.isFinite(autoMin) && Number.isFinite(autoMax)) {
    rangeHint.textContent =
      mode === "rows"
        ? "Row ranges are calculated from each row's numeric values."
        : "Column ranges are calculated from each column's numeric values.";
  } else {
    rangeHint.textContent = "No numeric values found in the table.";
  }
};

const parseTable = (text) => {
  const delimiter = normalizeDelimiter(delimiterInput.value || "comma");
  const parser = dsvFormat(delimiter);
  const rows = parser.parseRows(text);
  if (!rows.length) throw new Error("No rows found. Paste a table to begin.");
  const isMarkdownTable =
    delimiter === "|" && rows.some((row) => trimCell(row[0] ?? "") === "" && trimCell(row.at(-1) ?? "") === "");
  const normalizedRows = isMarkdownTable ? rows.map((row) => row.slice(1, -1)) : rows;
  const trimmedRows = normalizedRows.map((row) => row.map(trimCell));
  const filteredRows = trimmedRows.filter((row, index) => index === 0 || row.some((cell) => cell !== ""));
  if (!filteredRows.length) throw new Error("No usable rows found.");
  let [header, ...body] = filteredRows;
  if (isMarkdownTable) body = body.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
  const maxCols = Math.max(header.length, ...body.map((row) => row.length));
  if (!maxCols) throw new Error("No columns found in the table.");
  if (header.length < maxCols) {
    header = header.concat(
      Array.from({ length: maxCols - header.length }, (_, i) => `Column ${header.length + i + 1}`),
    );
  }
  const paddedBody = body.map((row) => row.concat(Array.from({ length: maxCols - row.length }, () => "")));
  return { header, rows: paddedBody };
};

const detectRowHeaders = (rows, numericParsers) => {
  if (!rows.length) return false;
  const firstColumn = rows.map((row) => trimCell(row[0] ?? "")).filter((value) => value !== "");
  if (!firstColumn.length) return false;
  const nonNumeric = firstColumn.filter((value) => numericParsers[0]?.(value) === null).length;
  const otherNumeric = rows.some((row) =>
    row.slice(1).some((cell, index) => numericParsers[index + 1]?.(cell) !== null),
  );
  return nonNumeric / firstColumn.length >= 0.8 && otherNumeric;
};

const updateRangeInputs = (min, max) => {
  const minText = Number.isFinite(min) ? `${min}` : "";
  const maxText = Number.isFinite(max) ? `${max}` : "";
  if (rangeMinInput.value === "" || rangeMinInput.value === `${lastAutoRange.min ?? ""}`) {
    rangeMinInput.value = minText;
  }
  if (rangeMaxInput.value === "" || rangeMaxInput.value === `${lastAutoRange.max ?? ""}`) {
    rangeMaxInput.value = maxText;
  }
  lastAutoRange = { min, max };
  if (!rangeHint) return;
  if (Number.isFinite(min) && Number.isFinite(max)) {
    rangeHint.textContent = `Data range: ${min} to ${max}`;
  } else {
    rangeHint.textContent = "No numeric values found in the table.";
  }
};

const resolveRange = (autoMin, autoMax) => {
  const minValue = parseRangeInput(rangeMinInput.value);
  const maxValue = parseRangeInput(rangeMaxInput.value);
  if (!Number.isFinite(autoMin) || !Number.isFinite(autoMax)) return { min: null, max: null };
  if (minValue === null || maxValue === null) return { min: autoMin, max: autoMax };
  if (minValue === maxValue) return { min: autoMin, max: autoMax };
  if (minValue > maxValue) return { min: maxValue, max: minValue };
  return { min: minValue, max: maxValue };
};

const contrastColor = (color) => {
  const colorRgb = rgb(color);
  const channels = [colorRgb.r, colorRgb.g, colorRgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

const renderEmptyState = () => {
  const empty = document.createElement("div");
  empty.className = "text-secondary";
  empty.textContent = "Paste data to see the generated HTML table.";
  previewContainer.replaceChildren(empty);
  copyButton.disabled = true;
  lastHtml = "";
};

const renderTable = () => {
  const raw = tableInput.value;
  const mode = getColorMode();
  updateRangeModeState(mode, null, null);
  if (!raw.trim()) {
    alertContainer?.replaceChildren();
    renderEmptyState();
    return;
  }

  try {
    const { header, rows } = parseTable(raw);
    const numericParsers = buildColumnNumericParsers(rows);
    const hasRowHeaders = detectRowHeaders(rows, numericParsers);
    const numericGrid = rows.map((row) =>
      row.map((cell, colIndex) => {
        if (hasRowHeaders && colIndex === 0) return null;
        return numericParsers[colIndex]?.(cell) ?? parseNumericValue(cell);
      }),
    );
    const numericValues = numericGrid.flat().filter((value) => Number.isFinite(value));
    const autoMin = numericValues.length ? Math.min(...numericValues) : null;
    const autoMax = numericValues.length ? Math.max(...numericValues) : null;
    const interpolator = getInterpolator();
    updateRangeModeState(mode, autoMin, autoMax);
    let tableScale = null;
    let rowScales = null;
    let columnScales = null;
    if (mode === "table") {
      updateRangeInputs(autoMin, autoMax);
      const { min, max } = resolveRange(autoMin, autoMax);
      tableScale = buildScale(min, max, interpolator);
    } else if (mode === "rows") {
      rowScales = numericGrid.map((row) => {
        const values = row.filter((value) => Number.isFinite(value));
        if (!values.length) return null;
        return buildScale(Math.min(...values), Math.max(...values), interpolator);
      });
    } else {
      const columnValues = Array.from({ length: header.length }, () => []);
      numericGrid.forEach((row) => {
        row.forEach((value, colIndex) => {
          if (Number.isFinite(value)) columnValues[colIndex].push(value);
        });
      });
      columnScales = columnValues.map((values) => {
        if (!values.length) return null;
        return buildScale(Math.min(...values), Math.max(...values), interpolator);
      });
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    header.forEach((cell) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = cell;
      th.style.textAlign = "left";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      row.forEach((cell, colIndex) => {
        const isRowHeader = hasRowHeaders && colIndex === 0;
        const numericValue = numericGrid[rowIndex][colIndex];
        const isNumeric = Number.isFinite(numericValue);
        const scale =
          mode === "table" ? tableScale : mode === "rows" ? rowScales?.[rowIndex] : columnScales?.[colIndex];
        const cellEl = document.createElement(isRowHeader ? "th" : "td");
        if (isRowHeader) cellEl.scope = "row";
        cellEl.textContent = cell;
        cellEl.style.textAlign = isNumeric ? "right" : "left";
        if (isNumeric && scale) {
          const bg = scale(numericValue);
          cellEl.style.backgroundColor = bg;
          cellEl.style.color = contrastColor(bg);
        }
        tr.appendChild(cellEl);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    previewContainer.replaceChildren(table);
    copyButton.disabled = false;
    lastHtml = formatTableHtml(table);
    alertContainer?.replaceChildren();
  } catch (error) {
    previewContainer.replaceChildren();
    copyButton.disabled = true;
    lastHtml = "";
    alert({ title: "Parse failed", body: error.message, color: "danger" });
  }
};

const handleCopy = async () => {
  if (!lastHtml) return;
  const ok = await copyText(lastHtml);
  if (ok) {
    alert({ title: "Copied", body: "HTML table copied to clipboard.", color: "success" });
  } else {
    alert({ title: "Copy failed", body: "Clipboard access was denied.", color: "danger" });
  }
};

renderGradientOptions();
updateCustomInputsState();
updateGradientPreview();
renderTable();

tableInput.addEventListener("input", renderTable);
delimiterInput.addEventListener("input", renderTable);
colorModeSelect?.addEventListener("change", renderTable);
rangeMinInput.addEventListener("input", renderTable);
rangeMaxInput.addEventListener("input", renderTable);
gradientSelect.addEventListener("change", () => {
  updateGradientPreview();
  renderTable();
});
reverseScaleInput?.addEventListener("input", () => {
  updateGradientPreview();
  renderTable();
});
customToggle.addEventListener("input", () => {
  updateCustomInputsState();
  updateGradientPreview();
  renderTable();
});
lowColorInput.addEventListener("input", () => {
  if (!customToggle.checked) return;
  updateGradientPreview();
  renderTable();
});
highColorInput.addEventListener("input", () => {
  if (!customToggle.checked) return;
  updateGradientPreview();
  renderTable();
});
copyButton.addEventListener("click", handleCopy);
