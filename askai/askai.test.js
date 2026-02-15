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

  it("opens the new Phind provider", () => {
    document.getElementById("question").value = "debug a stack trace";
    document.getElementById("ask-phind").click();

    expect(window.localStorage.getItem("askai:lastProvider")).toBe("phind");
    expect(window.__askaiRedirectTarget).toBe(
      "https://www.phind.com/search?q=debug%20a%20stack%20trace",
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

  it("redirects immediately to Google by default when q is present", async () => {
    ({ window } = await loadFrom(
      import.meta.dirname,
      "index.html?q=best+book",
    ));

    expect(window.__askaiRedirectTarget).toBe(
      "https://www.google.com/search?udm=50&q=best%20book",
    );
  });

  it("falls back to Google for invalid providers", async () => {
    ({ window } = await loadFrom(
      import.meta.dirname,
      "index.html?q=coffee&ai=invalid",
    ));

    expect(window.__askaiRedirectTarget).toBe(
      "https://www.google.com/search?udm=50&q=coffee",
    );
    expect(window.localStorage.getItem("askai:lastProvider")).toBe("google");
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
