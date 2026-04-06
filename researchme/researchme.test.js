import { beforeEach, describe, expect, it } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("researchme", () => {
  let window;
  let document;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.localStorage.clear();

    const nameInput = document.getElementById("name-input");
    const roleInput = document.getElementById("role-input");
    nameInput.value = "";
    roleInput.value = "";
    nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  });

  it("keeps launch buttons disabled until both fields are filled", () => {
    const nameInput = document.getElementById("name-input");
    const roleInput = document.getElementById("role-input");
    const chatgptButton = document.getElementById("chatgpt-button");
    const claudeButton = document.getElementById("claude-button");
    const status = document.getElementById("launch-status");

    expect(chatgptButton.disabled).toBe(true);
    expect(claudeButton.disabled).toBe(true);
    expect(status.textContent).toContain("Add both fields");

    nameInput.value = "Ada Lovelace";
    nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(chatgptButton.disabled).toBe(true);

    roleInput.value = "Chief Technology Officer";
    roleInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(chatgptButton.disabled).toBe(false);
    expect(claudeButton.disabled).toBe(false);
    expect(status.textContent).toContain("Ready.");
  });

  it("builds the provider URL with the encoded dossier prompt", () => {
    const nameInput = document.getElementById("name-input");
    const roleInput = document.getElementById("role-input");
    const chatgptButton = document.getElementById("chatgpt-button");
    const claudeButton = document.getElementById("claude-button");

    nameInput.value = "Ada Lovelace";
    roleInput.value = "Chief Technology Officer";
    roleInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    chatgptButton.click();

    const prompt = `Search online and build a **COMPREHENSIVE** public dossier on:

Name: Ada Lovelace
Role: Chief Technology Officer

Structure it as:

1. Career Timeline — Every posting and tenure you can find, with source and year. Flag any gaps.
2. Public Record — All public forums mentioning them, regulatory filings, court cases, audit observations, company directorships, government notifications, or institutional affiliations.
3. Media Presence — Notable speeches, interviews, quotes attributed to them.
4. Contradictions — Any case where two sources give conflicting facts about the same event, posting, or date. List each conflict explicitly.
5. Probable Errors — Claims that appear factually wrong based on cross-referencing. Explain why.
6. Confidence Rating — For each section, rate how complete you think your information is (High / Medium / Low) and why.

Be specific. Use web search. Cite sources. If you're uncertain, say so.`;

    expect(window.__researchmeRedirectTarget).toBe(
      `https://chatgpt.com/?q=${encodeURIComponent(prompt)}&model=gpt-5.4`,
    );

    claudeButton.click();

    expect(window.__researchmeRedirectTarget).toBe(
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}&model=claude-sonnet-4.6`,
    );
  });
});
