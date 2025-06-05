import { gemini } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/gemini.js";
import { anthropic } from "https://cdn.jsdelivr.net/npm/asyncllm@1/dist/anthropic.js";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3/+esm";

const openai = (d) => d;

const escapeHtml = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

const MODELS = [
  {
    adapter: gemini,
    model: "gemini-1.5-flash-001",
    url: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:generateContent`,
    extra: "",
  },
  {
    adapter: gemini,
    model: "gemini-1.5-flash-8b",
    url: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:generateContent`,
    extra: "",
  },
  {
    adapter: gemini,
    model: "gemini-1.5-flash-002",
    url: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:generateContent`,
    extra: "",
  },
  {
    adapter: gemini,
    model: "gemini-1.5-pro-002",
    url: (model) => `https://llmfoundry.straive.com/gemini/v1beta/models/${model}:generateContent`,
    extra: "",
  },
  {
    adapter: openai,
    model: "gpt-4o-mini",
    url: (model) => "https://llmfoundry.straive.com/openai/v1/chat/completions",
    extra: "",
  },
  {
    adapter: openai,
    model: "gpt-4o",
    url: (model) => "https://llmfoundry.straive.com/openai/v1/chat/completions",
    extra: "",
  },
  {
    adapter: openai,
    model: "chatgpt-4o-latest",
    url: (model) => "https://llmfoundry.straive.com/openai/v1/chat/completions",
    extra: "",
  },
  {
    adapter: anthropic,
    model: "claude-3-haiku-20240307",
    url: (model) => "https://llmfoundry.straive.com/anthropic/v1/messages",
    extra: "",
  },
  {
    adapter: anthropic,
    model: "claude-3-5-sonnet-20241022",
    url: (model) => "https://llmfoundry.straive.com/anthropic/v1/messages",
    extra: "",
  },
  {
    adapter: openai,
    model: "llama-3.2-11b-vision-preview",
    url: (model) => "https://llmfoundry.straive.com/groq/openai/v1/chat/completions",
    extra: "",
  },
  {
    adapter: openai,
    model: "llama-3.2-90b-vision-preview",
    url: (model) => "https://llmfoundry.straive.com/groq/openai/v1/chat/completions",
    extra: "",
  },
  {
    adapter: openai,
    model: "qwen/qwen-2-vl-72b-instruct",
    url: (model) => "https://llmfoundry.straive.com/openrouter/v1/chat/completions",
    extra: ".",
  },
  {
    adapter: openai,
    model: "mistralai/pixtral-12b",
    url: (model) => "https://llmfoundry.straive.com/openrouter/v1/chat/completions",
    extra: ".",
  },
];

/**
 * Creates a canvas element for a specific model
 * @param {string} modelName - Name of the model
 * @returns {HTMLCanvasElement}
 */
function createModelCanvas(modelName) {
  const container = document.getElementById("modelResults");
  container.insertAdjacentHTML(
    "beforeend",
    `
        <canvas id="canvas-${modelName}" class="img-fluid"></canvas>
        <table id="table-${modelName}" class="table table-striped mt-2">
          <thead>
            <tr>
              <th>Object</th>
              <th>Color</th>
              <th>Position (x1,y1,x2,y2)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `,
  );
  return document.getElementById(`canvas-${modelName}`);
}

/**
 * Handles image upload and object detection for all models
 * @param {File} file - The uploaded image file
 */
async function handleImageUpload(file) {
  document.getElementById("modelResults").innerHTML = "";
  document.getElementById("downloadBtn").classList.remove("d-none");

  try {
    const image = await createImageFromFile(file);

    // Process all models in parallel
    await Promise.all(
      MODELS.map(async ({ adapter, model, url, extra }) => {
        const canvas = createModelCanvas(model);
        const ctx = canvas.getContext("2d");

        // Set canvas dimensions and draw image
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const response = await detectObjects(file, adapter, model, url, extra, image.width, image.height);
        drawBoundingBoxes(ctx, response.objects, model);
      }),
    );
  } catch (error) {
    console.error("Error processing image:", error);
    alert("Error processing image. Please try again.");
  }
}

/**
 * Creates an Image object from a File
 * @param {File} file - The image file
 * @returns {Promise<HTMLImageElement>}
 */
function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

/**
 * Sends image to Gemini API for object detection
 * @param {File} file - The image file to analyze
 * @returns {Promise<{string: [string, number, number, number, number]}>}
 */
async function detectObjects(file, adapter, model, url, extra, width, height) {
  try {
    // Convert image to base64
    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });

    const response = await fetch(url(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(
        adapter({
          model,
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Detect objects in this ${width}x${height} px image and return their color and bounding boxes in pixels. Respond as a JSON object: {[label]: [color, x1, y1, x2, y2], ...}${extra}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${file.type};base64,${base64Data}` },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      ),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let result =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      data.choices?.[0]?.message?.content ??
      data?.content?.[0]?.text;
    if (!result) throw new Error("No detection results received");

    // If result has a ```json``` block, use that as the JSON
    if (result.includes("```")) {
      result = result
        .split("\n")
        .slice(
          result.split("\n").findIndex((line) => line.trim().startsWith("```")) + 1,
          result.split("\n").findIndex((line) => line.trim() === "```"),
        )
        .join("\n");
    }

    // Parse the response text as JSON
    return { objects: JSON.parse(result) };
  } catch (error) {
    console.error("Object detection failed:", error);
    throw new Error("Failed to detect objects in image");
  }
}

/**
 * Draws bounding boxes and updates results table
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {[string, string, number, number, number, number][]} objects - Array of detected objects
 */
function drawBoundingBoxes(ctx, objects, model) {
  // Clear and show table
  const table = document.getElementById(`table-${model}`);
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  table.classList.remove("d-none");

  Object.entries(objects).forEach(([label, [color, x1, y1, x2, y2]]) => {
    // Draw rectangle and label (existing code)
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(label, x1, y1 - 5);

    ctx.font = "36px Arial";
    ctx.fillText(model, 0, 36);

    // Add table row
    tbody.insertAdjacentHTML(
      "beforeend",
      `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td>${escapeHtml(color)}</td>
            <td>${x1},${y1},${x2},${y2}</td>
          </tr>
        `,
    );
  });
}

/**
 * Downloads all canvases as a zip file
 */
async function downloadResults() {
  const zip = new JSZip();

  for (const { model } of MODELS) {
    const canvas = document.getElementById(`canvas-${model}`);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp");
    });
    zip.file(`${model}.webp`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = "detection-results.zip";
  link.click();
  URL.revokeObjectURL(link.href);
}

// Event listeners
document
  .getElementById("imageInput")
  .addEventListener("change", (e) => e.target.files?.[0] && handleImageUpload(e.target.files[0]));

document.getElementById("downloadBtn").addEventListener("click", downloadResults);
