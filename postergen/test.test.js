import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const originalFetch = globalThis.fetch;

let window, document, templateGallery, logoGallery, posterForm, errorMessage, openaiConfigBtn;
let consoleErrorSpy;

describe("Postergen tests", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    globalThis.openaiReturn = { apiKey: "", baseUrl: "url" };
    globalThis.openaiCalls = [];
    globalThis.fetch = (url, opts) => {
      if (typeof url === "string" && url.includes("bootstrap-llm-provider@1"))
        return Promise.resolve(
          new Response(
            "export async function openaiConfig(opts){globalThis.openaiCalls.push(opts);return globalThis.openaiReturn}",
            { headers: { "Content-Type": "application/javascript" } },
          ),
        );
      if (typeof url === "string" && url.includes("asyncllm@2"))
        return Promise.resolve(
          new Response("export async function* asyncLLM(){ yield { content: '' } }", {
            headers: { "Content-Type": "application/javascript" },
          }),
        );
      if (typeof url === "string" && url.includes("marked@13"))
        return Promise.resolve(
          new Response("export class Marked { parse(s){return s;} }", {
            headers: { "Content-Type": "application/javascript" },
          }),
        );
      if (typeof url === "string" && url.includes("html2canvas"))
        return Promise.resolve(
          new Response("export default function html2canvas(){return Promise.resolve({toDataURL:()=>''})}", {
            headers: { "Content-Type": "application/javascript" },
          }),
        );
      if (typeof url === "string" && url.includes("pptxgenjs"))
        return Promise.resolve(
          new Response(
            "export default function pptxgenjs(){return {addSlide(){return {addText(){},addImage(){}}},writeFile(){}}}",
            { headers: { "Content-Type": "application/javascript" } },
          ),
        );
      return originalFetch(url, opts);
    };
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    templateGallery = document.getElementById("template-gallery");
    logoGallery = document.getElementById("logo-gallery");
    posterForm = document.getElementById("poster-form");
    errorMessage = document.getElementById("error-message");
    openaiConfigBtn = document.getElementById("openai-config-btn");
    await vi.runAllTimers();
    await Promise.resolve();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it("selects template and logo", () => {
    const templateCard = templateGallery.querySelector(".template-card");
    const logoCard = logoGallery.querySelector(".logo-card");
    templateCard.click();
    logoCard.click();
    expect(templateCard.classList.contains("active")).toBe(true);
    expect(logoCard.classList.contains("active")).toBe(true);
    expect(posterForm.dataset.selectedTemplate).toBe("0");
    expect(posterForm.dataset.selectedLogo).toBe("0");
  });

  it("shows error when submitting without selections", () => {
    posterForm.dispatchEvent(new window.Event("submit", { bubbles: true }));
    expect(errorMessage.classList.contains("d-none")).toBe(false);
  });

  it("invokes openaiConfig when config button clicked", () => {
    openaiConfigBtn.click();
    expect(globalThis.openaiCalls.length).toBe(1);
  });
});
