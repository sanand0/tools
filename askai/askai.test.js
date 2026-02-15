import { beforeEach, describe, expect, it } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("askai", () => {
  let window;
  let document;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.localStorage.clear();
  });

  it("opens the selected AI and stores preference", () => {
    document.getElementById("question").value = "What is life";
    document.getElementById("ask-claude").click();

    expect(window.localStorage.getItem("askai:lastProvider")).toBe("claude");
    expect(window.__askaiRedirectTarget).toBe(
      "https://claude.ai/new?q=What%20is%20life",
    );
  });

  it("copies a share link with q parameter", async () => {
    document.getElementById("question").value = "hello world";

    document.getElementById("copy-link").click();

    expect(await window.navigator.clipboard.readText()).toBe(
      "https://test/askai/index.html?q=hello+world",
    );
    expect(document.getElementById("status").textContent).toBe("Link copied.");
  });

  it("redirects immediately to ChatGPT by default when q is present", async () => {
    ({ window } = await loadFrom(
      import.meta.dirname,
      "index.html?q=best+book",
    ));

    expect(window.__askaiRedirectTarget).toBe(
      "https://chatgpt.com/?q=best%20book",
    );
  });

  it("uses ai query parameter over stored preference", async () => {
    window.localStorage.setItem("askai:lastProvider", "claude");

    ({ window } = await loadFrom(
      import.meta.dirname,
      "index.html?q=coffee&ai=grok",
    ));

    expect(window.__askaiRedirectTarget).toBe("https://grok.com/?q=coffee");
    expect(window.localStorage.getItem("askai:lastProvider")).toBe("grok");
  });
});
