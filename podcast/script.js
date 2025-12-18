import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";
import { loadConfigJson, readParam } from "../common/demo.js";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];
let savedForm;

document.addEventListener("DOMContentLoaded", async () => {
  savedForm = saveform("#podcast-form", { exclude: '[type="file"]' });

  // DOM Elements
  const openaiConfigBtn = document.getElementById("openai-config-btn");
  const systemPromptInput = document.getElementById("systemPromptInput");
  const modelInput = document.getElementById("model");
  const voice1NameInput = document.getElementById("voice1Name");
  const voice1TypeSelect = document.getElementById("voice1Type");
  const voice1InstructionsInput = document.getElementById("voice1Instructions");
  const voice2NameInput = document.getElementById("voice2Name");
  const voice2TypeSelect = document.getElementById("voice2Type");
  const voice2InstructionsInput = document.getElementById("voice2Instructions");
  const contentInput = document.getElementById("contentInput");
  const podcastScriptTextarea = document.getElementById("podcastScript");
  const generateScriptBtn = document.getElementById("generateScriptBtn");
  const generateAudioBtn = document.getElementById("generateAudioBtn");
  const downloadAudioBtn = document.getElementById("downloadAudioBtn");
  const audioContainer = document.getElementById("audioContainer");
  const podcastAudio = document.getElementById("podcastAudio");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const alertContainer = document.getElementById("alertContainer");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");
  const sampleContainer = document.getElementById("sampleContainer");

  openaiConfigBtn.addEventListener("click", async () => {
    await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, help: openaiHelp });
  });

  // Function to show alerts
  function showAlert(message, type = "danger") {
    alertContainer.innerHTML = `
          <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
  }

  // Function to update progress
  function updateProgress(percent, text = "") {
    progressContainer.classList.remove("d-none");
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", percent);
    if (text) progressBar.textContent = text;
  }

  // Function to get current voice settings
  function getVoiceSettings() {
    return {
      voice1: {
        name: voice1NameInput.value,
        voice: voice1TypeSelect.value,
        instructions: voice1InstructionsInput.value,
      },
      voice2: {
        name: voice2NameInput.value,
        voice: voice2TypeSelect.value,
        instructions: voice2InstructionsInput.value,
      },
    };
  }

  // Function to get system prompt with variables replaced
  function systemPrompt(voice1, voice2) {
    let prompt = systemPromptInput.value;
    // Replace variables in the system prompt
    prompt = prompt.replace(/\${voice1\.name}/g, voice1.name);
    prompt = prompt.replace(/\${voice2\.name}/g, voice2.name);
    // Current date
    const now = new Date();
    const weekFormat = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    prompt = prompt.replace(/\$WEEK/g, weekFormat.format(now));

    return prompt;
  }

  // Generate Script
  generateScriptBtn.addEventListener("click", async () => {
    const content = contentInput.value.trim();
    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });
    const model = modelInput.value.trim();

    if (!content) return showAlert("Please enter some content to convert to a podcast.");
    if (!apiKey) return showAlert("Configure your OpenAI API key first.");

    try {
      // Reset UI
      alertContainer.innerHTML = "";
      podcastScriptTextarea.value = "";
      podcastScriptTextarea.removeAttribute("readonly");
      generateScriptBtn.disabled = true;
      generateScriptBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Generating...';

      const voices = getVoiceSettings();
      const prompt = systemPrompt(voices.voice1, voices.voice2);

      // Import asyncLLM
      const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");

      // Stream the response
      for await (const { content: responseContent } of asyncLLM(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content },
          ],
        }),
      })) {
        podcastScriptTextarea.value = responseContent ?? "";
        podcastScriptTextarea.scrollTop = podcastScriptTextarea.scrollHeight;
      }
      if (!podcastScriptTextarea.value) showAlert("No content generated. Check your settings.", "warning");
    } catch (error) {
      showAlert(`Error generating script: ${error.message}`);
      console.error("Script generation error:", error);
    } finally {
      generateScriptBtn.disabled = false;
      generateScriptBtn.innerHTML = '<i class="bi bi-magic me-2"></i>Generate Script';
    }
  });

  // Generate Audio
  generateAudioBtn.addEventListener("click", async () => {
    const script = podcastScriptTextarea.value.trim();
    if (!script) return showAlert("Please generate a podcast script first.");

    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });

    try {
      alertContainer.innerHTML = "";
      generateAudioBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Generating Audio...';

      // Parse the script into speaker lines
      const lines = script.split("\n").filter((line) => line.trim());
      const voices = getVoiceSettings();
      const speakerMap = {
        [voices.voice1.name]: voices.voice1,
        [voices.voice2.name]: voices.voice2,
      };

      // Array to store audio buffers
      const audioBuffers = [];

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Find the speaker name (everything before the first colon)
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;

        const speakerName = line.substring(0, colonIndex).trim();
        const speakerLine = line.substring(colonIndex + 1).trim();

        // Find the voice for this speaker
        const voice = speakerMap[speakerName];
        if (!voice) continue;

        updateProgress(Math.round((i / lines.length) * 100), `Generating audio: ${i + 1}/${lines.length}`);

        // Generate audio for this line
        const response = await fetch(`${baseUrl}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            input: speakerLine,
            voice: voice.voice,
            instructions: voice.instructions,
            response_format: "opus",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        // Get audio data
        const audioBuffer = await response.arrayBuffer();
        audioBuffers.push(audioBuffer);
      }

      updateProgress(100, "Processing audio...");

      // Combine all audio buffers into a single blob
      const blob = new Blob(audioBuffers, { type: "audio/ogg; codecs=opus" });
      podcastAudio.src = URL.createObjectURL(blob);

      // Show audio player and download button
      audioContainer.classList.remove("d-none");
      downloadAudioBtn.classList.remove("d-none");

      // Set up download button
      downloadAudioBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = podcastAudio.src;
        link.download = `podcast_${new Date().toISOString().split("T")[0]}.ogg`;
        link.click();
      };
    } catch (error) {
      showAlert(`Error generating audio: ${error.message}`);
      console.error("Audio generation error:", error);
    } finally {
      generateAudioBtn.innerHTML = '<i class="bi bi-file-earmark-music me-2"></i>Generate Audio';
      progressContainer.classList.add("d-none");
    }
  });

  resetSettingsBtn.addEventListener("click", () => {
    savedForm.clear();
    location.reload();
  });

  try {
    const config = await loadConfigJson("config.json");
    const sources = Array.isArray(config?.sources) ? config.sources : [];
    if (sampleContainer && sources.length) {
      const label = document.createElement("span");
      label.className = "text-secondary small fw-semibold me-1";
      label.textContent = "Examples";
      sampleContainer.replaceChildren(
        label,
        ...sources.map((source) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn-sm btn-outline-secondary";
          button.textContent = source.name || source.id;
          button.addEventListener("click", () => {
            contentInput.value = source.content || "";
          });
          return button;
        }),
      );
    }

    const sourceId = readParam("source", { fallback: "" });
    const source = sources.find((item) => item.id === sourceId);
    if (source?.content) contentInput.value = source.content;
    if (!contentInput.value.trim() && sources.length) contentInput.value = sources[0].content || "";
  } catch {
    // ignore missing config
  }

  const urlModel = readParam("model", { fallback: "" });
  if (urlModel) modelInput.value = urlModel;
  const urlVoice1 = readParam("voice1", { fallback: "" });
  if (urlVoice1) voice1NameInput.value = urlVoice1;
  const urlVoice2 = readParam("voice2", { fallback: "" });
  if (urlVoice2) voice2NameInput.value = urlVoice2;
});
