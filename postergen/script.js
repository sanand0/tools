import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import { default as html2canvas } from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js";
import pptxgenjs from "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { llmfoundryHelp } from "../common/aiconfig.js";
import { getClosestAspectRatio } from "./utils.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { readParam } from "../common/demo.js";

const baseUrls = [
  { url: "https://llmfoundry.straive.com/openai/v1", name: "LLM Foundry" },
  { url: "https://llmfoundry.straive.com/openai/v1", name: "LLM Foundry (demo)" },
];

const loading = /* html */ `
  <div class="d-flex justify-content-center align-items-center">
    <div class="spinner-border" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
`;

const $aspectRatio = document.querySelector("#aspect-ratio");
const $templateGallery = document.getElementById("template-gallery");
const $logoGallery = document.getElementById("logo-gallery");
const $submitContainer = document.getElementById("submit-container");
const $errorMessage = document.getElementById("error-message");
const $response = document.getElementById("response");
const $posterForm = document.getElementById("poster-form");
const $poster = document.getElementById("poster");
const $downloadContainer = document.getElementById("download-container");
const $downloadPNG = document.getElementById("download-png");
const $downloadPPTX = document.getElementById("download-pptx");
const $sampleContainer = document.getElementById("sampleContainer");

// Image enhancement elements
const $imageEnhancementContainer = document.getElementById("image-enhancement-container");
const $enhancementPrompt = document.getElementById("enhancement-prompt");
const $conversationHistory = document.getElementById("conversation-history");
const $openaiConfigBtn = document.getElementById("openai-config-btn");

const marked = new Marked();
saveform("#poster-form", { exclude: '[type="file"]' });

// Add config button event listener
$openaiConfigBtn.addEventListener("click", async () => {
  await openaiConfig({ baseUrls, show: true, help: llmfoundryHelp });
});

const responseSchema = `
Add your JSON response in this format:

\`\`\`json
{
  "component-name": {
    "@text": "text for a text component",
    "font-family": ... // if needed
    ...
  },
  "component-name": {
    "@prompt": "prompt for an image",
    ...
  },
  ...
}
\`\`\`
`;

// Current template, logo, brief
let template;
let logo;
let brief;

// Load configuration and render templates.
$templateGallery.innerHTML = loading;
const { templates, logos, presets } = await fetch("config.json").then((res) => res.json());
const sections = [
  { type: "template", $gallery: $templateGallery, items: templates, cols: "col-12 col-sm-3" },
  { type: "logo", $gallery: $logoGallery, items: logos, cols: "col-12 col-sm-2 col-lg-1" },
];

for (const { type, $gallery, items, cols } of sections) {
  $gallery.innerHTML = /* html */ `
    <div class="row g-4 justify-content-center align-items-start">
    ${items
      .map(
        (item, index) => /* html */ `
        <div class="${cols}">
          <div class="card h-100 ${type}-card" data-${type}-id="${index}">
            <div class="card-img-container ratio ratio-1x1 bg-body-tertiary">
              <img src="${item.image}" class="card-img-top object-fit-contain" alt="${item.name}">
            </div>
          </div>
        </div>`,
      )
      .join("")}
    </div>
  `;

  // Clicking on a template or logo selects it
  $gallery.querySelectorAll(`.${type}-card`).forEach((card) => {
    card.addEventListener("click", () => {
      // Remove active class from all cards of this type
      $gallery.querySelectorAll(`.${type}-card`).forEach((c) => c.classList.remove("active"));
      // Add active class to clicked card
      card.classList.add("active");
      // Store selected item ID
      const itemId = card.dataset[`${type}Id`];
      $posterForm.dataset[`selected${type.charAt(0).toUpperCase() + type.slice(1)}`] = itemId;
    });
  });
}

const normalize = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function selectById(type, id) {
  const gallery = type === "template" ? $templateGallery : $logoGallery;
  const items = type === "template" ? templates : logos;
  const index =
    type === "template"
      ? items.findIndex((item) => item.id === id)
      : items.findIndex((item) => normalize(item.name) === normalize(id) || item.name === id);
  if (index < 0) return false;
  const card = gallery.querySelector(`.${type}-card[data-${type}-id="${index}"]`);
  card?.click();
  return true;
}

function renderPresets(value) {
  if (!$sampleContainer) return;
  if (!Array.isArray(value) || !value.length) {
    $sampleContainer.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  $sampleContainer.replaceChildren(
    label,
    ...value.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = preset.name || preset.id;
      button.addEventListener("click", () => {
        if (preset.template) selectById("template", preset.template);
        if (preset.logo) selectById("logo", preset.logo);
        if (preset.brief) document.getElementById("brief").value = preset.brief;
        document.getElementById("brief").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return button;
    }),
  );
}

renderPresets(presets);

const urlTemplate = readParam("template", { fallback: "" });
const urlLogo = readParam("logo", { fallback: "" });
const urlBrief = readParam("brief", { fallback: "", trim: false });
if (urlTemplate) selectById("template", urlTemplate);
if (urlLogo) selectById("logo", urlLogo);
if (urlBrief) document.getElementById("brief").value = urlBrief;

// Render the generation form
$submitContainer.innerHTML = /* html */ `<button type="submit" class="btn btn-primary btn-lg"><i class="bi bi-stars me-2"></i>Generate Poster</button>`;

// Handle form submission
$posterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const $template = $templateGallery.querySelector(`.active[data-template-id]`);
  const $logo = $logoGallery.querySelector(`.active[data-logo-id]`);
  if (!$template || !$logo) {
    $errorMessage.classList.remove("d-none");
    return;
  } else {
    $errorMessage.classList.add("d-none");
  }

  // Get API config
  const { apiKey, baseUrl } = await openaiConfig({ baseUrls, help: llmfoundryHelp });
  if (!apiKey) return;

  template = templates[$template.dataset.templateId];
  logo = logos[$logo.dataset.logoId];
  brief = e.target.brief.value;

  // Show a loading icon while awaiting poster generation
  $response.innerHTML = loading;
  $downloadContainer.classList.add("d-none");

  // Get the current aspect ratio
  const $option = $aspectRatio.querySelector(`option[value="${$aspectRatio.value}"]`);
  const { width, height } = $option.dataset;
  // Import and execute the template
  const posterFunction = (await import(`./templates/${template.id}.js`)).default;
  $poster.innerHTML = posterFunction(width, height);

  // Replace all logos with the selected logo
  for (const $logo of $poster.querySelectorAll('[data-type="logo"]')) $logo.src = logo.image;

  let responseContent;
  for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: e.target.system.value + responseSchema },
        { role: "user", content: `Poster for ${logo.name}\n\n${brief}\n\nCOMPONENTS:\n${getComponentsPrompt()}` },
      ],
    }),
  })) {
    responseContent = content;
    $response.innerHTML = marked.parse(content);
  }

  await applyChanges(responseContent, { apiKey, baseUrl });
  $downloadContainer.classList.remove("d-none");

  // Show the image enhancement conversation box after poster is generated
  $imageEnhancementContainer.classList.remove("d-none");

  // Add initial message to conversation
  addMessageToConversation("system", "I'll enhance your poster images/text. Describe your changes.");
});

async function drawImage({ prompt, aspectRatio, apiKey, baseUrl }) {
  const body = {
    instances: [{ prompt }],
    parameters: { aspectRatio, enhancePrompt: true, sampleCount: 1, safetySetting: "block_only_high" },
  };
  const url = baseUrl.replace("openai/v1", "vertexai/google/models/imagen-4.0-generate-preview-06-06:predict");
  const data = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  }).then((res) => res.json());
  const { mimeType, bytesBase64Encoded } = data.predictions[0];
  return `data:${mimeType};base64,${bytesBase64Encoded}`;
}

// Utility function for creating message HTML
function createMessageHTML(content, role, isLoading = false) {
  const iconClass = role === "user" ? "bi-person-fill" : "bi-robot";
  const bgClass = role === "user" ? "bg-primary" : "bg-success";
  const loadingSpinner = isLoading ? `<div class="spinner-border spinner-border-sm me-2" role="status"></div>` : "";
  return `
    <div class="d-flex align-items-center">
      <div class="message-avatar ${bgClass} text-white rounded-circle p-2 me-2 d-flex align-items-center justify-content-center"
           style="width: 32px; height: 32px; min-width: 32px;">
        <i class="bi ${iconClass}"></i>
      </div>
      <div class="message-content p-2 rounded">
        ${loadingSpinner}${content}
      </div>
    </div>`;
}

function addMessageToConversation(role, content, isLoading = false) {
  const messageId = Date.now().toString();
  const msg = `
    <div id="msg-${messageId}" class="message ${role}-message mb-2">${createMessageHTML(content, role, isLoading)}</div>
  `;
  $conversationHistory.insertAdjacentHTML("beforeend", msg);
  $conversationHistory.scrollTop = $conversationHistory.scrollHeight;
  return messageId;
}

$imageEnhancementContainer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userPrompt = $enhancementPrompt.value.trim();
  $enhancementPrompt.value = "";
  if (!userPrompt) return;
  // Add user message with loading state
  const msgId = addMessageToConversation("user", userPrompt, true);
  const $template = $templateGallery.querySelector(`.active[data-template-id]`);
  const $logo = $logoGallery.querySelector(`.active[data-logo-id]`);
  if (!$template || !$logo) {
    $errorMessage.classList.remove("d-none");
    return;
  } else $errorMessage.classList.add("d-none");
  template = templates[$template.dataset.templateId];
  logo = logos[$logo.dataset.logoId];

  // Show a loading icon while awaiting poster generation
  $downloadContainer.classList.add("d-none");

  try {
    // Get API config
    const { apiKey, baseUrl } = await openaiConfig({ baseUrls, help: llmfoundryHelp });
    if (!apiKey) return;

    const responseContent = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Update only required components and properties\n\n${userPrompt}\n\n` + responseSchema,
          },
          { role: "user", content: `Poster for ${logo.name}\n\nCOMPONENTS:\n${getComponentsPrompt()}` },
        ],
      }),
    })
      .then((res) => res.json())
      .then((res) => res.choices[0].message.content);

    await applyChanges(responseContent, { enhance: true, apiKey, baseUrl });
    $downloadContainer.classList.remove("d-none");

    // Remove loading state and add completion message
    document.querySelector(`#msg-${msgId} .spinner-border`)?.remove();
    addMessageToConversation("assistant", "Done. Anything else?");
  } catch (error) {
    console.error("Error enhancing poster:", error);
    // Remove loading state and show error
    document.querySelector(`#msg-${msgId} .spinner-border`)?.remove();
    addMessageToConversation("assistant", `🔴 Error: ${error}`);
  }
});

async function enhanceImage({ originalImage, prompt, apiKey, baseUrl }) {
  // Extract base64 data if it's a data URL
  const imageData = originalImage.startsWith("data:") ? originalImage.split(",")[1] || originalImage : originalImage;
  const url = baseUrl.replace(
    "openai/v1",
    "gemini/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent",
  );
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `Enhance this image with the following instructions: ${prompt}` },
            { inline_data: { mime_type: "image/png", data: imageData } },
          ],
        },
      ],
      generationConfig: { responseModalities: ["Text", "Image"] },
    }),
  }).then((res) => res.json());

  const { mimeType, data } = response.candidates[0].content.parts[1].inlineData;
  return `data:${mimeType};base64,${data}`;
}

$downloadPNG.addEventListener("click", () => {
  html2canvas($poster.firstChild, {
    backgroundColor: null,
  }).then(function (canvas) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "poster.png";
    a.click();
  });
});

$downloadPPTX.addEventListener("click", () => {
  const $root = $poster.firstChild;
  const posterRect = $root.getBoundingClientRect();
  const width = posterRect.width;
  const height = posterRect.height;
  const dpi = 72;

  let pptx = new pptxgenjs();
  pptx.title = `${logo.name} ${brief}. Template: ${template.name}`;
  pptx.author = "PosterGen";

  pptx.defineLayout({ name: "PosterGen", width: width / dpi, height: height / dpi });
  pptx.layout = "PosterGen";

  const slide = pptx.addSlide();

  Array.from($root.children).forEach((child) => {
    const rect = child.getBoundingClientRect();
    const position = {
      x: (rect.left - posterRect.left) / dpi,
      y: (rect.top - posterRect.top) / dpi,
      w: rect.width / dpi,
      h: rect.height / dpi,
    };

    if (child.tagName.toLowerCase() === "img") {
      // Calculate the displayed dimensions based on object-fit: contain
      const imgPosition = { ...position };

      // If the style has an object-fit: contain, use the natural dimensions of the image
      if (child.style.objectFit === "contain") {
        // Get the natural dimensions of the image
        const naturalWidth = child.naturalWidth;
        const naturalHeight = child.naturalHeight;

        // Calculate the aspect ratio of the image
        const imageRatio = naturalWidth / naturalHeight;
        const containerRatio = rect.width / rect.height;

        // Adjust dimensions based on object-fit: contain logic
        if (imageRatio > containerRatio) {
          // Image is wider than container (relative to height)
          const displayedHeight = rect.width / imageRatio;
          imgPosition.y += (rect.height - displayedHeight) / 2 / dpi;
          imgPosition.h = displayedHeight / dpi;
        } else {
          // Image is taller than container (relative to width)
          const displayedWidth = rect.height * imageRatio;
          imgPosition.x += (rect.width - displayedWidth) / 2 / dpi;
          imgPosition.w = displayedWidth / dpi;
        }
      }

      slide.addImage({
        ...imgPosition,
        ...(child.src.startsWith("data:") ? { data: child.src } : { path: child.src }),
      });
    } else {
      const computed = window.getComputedStyle(child);
      const bgColor = rgbToHex(computed.backgroundColor);

      // Extract transparency from rgba background if present
      let transparency = 0;
      const bgMatch = computed.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
      if (bgMatch && bgMatch[4] !== undefined) transparency = Math.round((1 - parseFloat(bgMatch[4])) * 100);

      slide.addText(child.innerText.trim(), {
        ...position,
        // Convert font size from pixels to inches to points (72 points = 1 inch)
        fontSize: (parseFloat(computed.fontSize) / dpi) * 72,
        // fontFace: computed.fontFamily,
        color: rgbToHex(computed.color),
        fill: { color: bgColor, transparency },
        bold: computed.fontWeight === "bold" || parseInt(computed.fontWeight) >= 700,
        italic: computed.fontStyle === "italic",
        underline: computed.textDecorationLine.includes("underline"),
        align: computed.textAlign || "left",
      });
    }
  });

  pptx.writeFile({ fileName: "poster.pptx" });
});

function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result) return "#000000";
  return (
    "#" +
    result
      .slice(0, 3)
      .map((x) => {
        let hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

// Create the components prompt section. It'll be "data-name: data-prompt\n..."
const getComponentsPrompt = () =>
  [...$poster.querySelectorAll("[data-name]")]
    .map(
      (el) => `${el.dataset.name}:
  type: ${el.tagName == "IMG" ? "image" : "text"}
  ${el.tagName == "IMG" ? "@prompt" : "@text"}: ${el.tagName == "IMG" ? "" : el.textContent || el.dataset.prompt}
  styles: ${el.style.cssText}`,
    )
    .join("\n\n");

function applyChanges(responseContent, { enhance = false, apiKey, baseUrl } = {}) {
  const match = responseContent.match(/```json(.*)```/s);
  const params = match ? JSON.parse(match[1]) : JSON.parse(responseContent);

  const imagePromises = []; // Collect all promises
  // Update the components using the params
  for (const [name, config] of Object.entries(params)) {
    const $el = $poster.querySelector(`[data-name="${name}"]`);
    if (!$el) {
      console.error(`data-name="${name}" not found`);
      continue;
    }

    // Apply styles if they exist in the config
    for (const [prop, value] of Object.entries(config)) {
      if (prop === "@text") $el.textContent = value;
      else if (prop === "@prompt" && $el.tagName === "IMG") {
        let imagePromise;
        if (enhance) imagePromise = enhanceImage({ prompt: value, originalImage: $el.src, apiKey, baseUrl });
        else {
          $el.src = "loading.svg";
          imagePromise = drawImage({
            prompt: value,
            aspectRatio: getClosestAspectRatio($el.width / $el.height),
            apiKey,
            baseUrl,
          });
        }
        imagePromises.push(imagePromise.then(async (src) => ($el.src = src))); // Add to promises array
      } else if (prop === "styles") {
        if (typeof value === "string") $el.style.cssText = value;
        else Object.assign($el.style, value);
      } else if (!prop.startsWith("@")) $el.style[prop] = value;
    }
  }
  return Promise.all(imagePromises);
}
