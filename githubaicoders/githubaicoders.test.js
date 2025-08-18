import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("GitHub AI Coders", async () => {
  let window, document, form, sourceSelect, maxInput, results, spinner;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    form = document.getElementById("search-form");
    sourceSelect = document.getElementById("source-select");
    maxInput = document.getElementById("max-results");
    results = document.getElementById("results");
    spinner = document.getElementById("spinner");
    window.fetch = vi.fn(async (url) => {
      if (url.includes("search/issues"))
        return {
          ok: true,
          json: async () => ({
            items: [
              { user: { login: "alice" }, repository_url: "https://api.github.com/repos/a/r1" },
              { user: { login: "alice" }, repository_url: "https://api.github.com/repos/b/r2" },
            ],
          }),
        };
      if (url.endsWith("/repos/a/r1")) return { ok: true, json: async () => ({ stargazers_count: 32 }) };
      if (url.endsWith("/repos/b/r2")) return { ok: true, json: async () => ({ stargazers_count: 8 }) };
      return { ok: false, text: async () => "error" };
    });
  });

  it("aggregates PRs and renders table", async () => {
    sourceSelect.value = "head:codex/";
    maxInput.value = "2";
    form.dispatchEvent(new window.Event("submit"));
    for (let i = 0; i < 5 && !results.querySelector("tbody tr"); i++) await sleep(0);
    const tbody = results.querySelector("tbody");
    expect(spinner.classList.contains("d-none")).toBe(true);
    expect(tbody.textContent).toContain("alice");
    expect(tbody.textContent).toContain("8.00");
    const links = tbody.querySelectorAll("a");
    expect(links[0].href).toContain("github.com/alice");
    expect(links[1].href).toContain("a/r1");
  });
});
