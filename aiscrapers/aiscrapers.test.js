import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("geminiscraper table handling", () => {
  let window;
  let document;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname, "__fixtures__/table.html"));
  });

  it("converts table blocks into markdown tables", () => {
    const markdown = window.geminiscraper.extractConversation(document);

    expect(markdown).toContain("| Context | Recommended Question | Mechanism |");
    expect(markdown).toContain("| --- | --- | --- |");
    expect(markdown).toContain(
      '| **Universal** | "The crystal ball says it failed. What\'s the story?" | Prospective Hindsight |',
    );
  });

  it("preserves footer text outside the markdown table", () => {
    const markdown = window.geminiscraper.extractConversation(document);

    const tableIndex = markdown.indexOf("| Context | Recommended Question | Mechanism |");
    const footerIndex = markdown.indexOf("Export to Sheets");
    expect(tableIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(tableIndex);
  });

  it("separates table footer text from following headings", () => {
    const markdown = window.geminiscraper.extractConversation(document);
    expect(markdown).toContain("Export to Sheets\n\n### Next Step");
  });
});

describe("claudescraper conversation extraction", () => {
  it("extracts user and Claude turns in order", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
    const markdown = window.claudescraper.extractConversation(document);

    expect(markdown).toContain('title: "Claude Fixture"');
    expect(markdown).toContain("## User\n\nGive me a short plan.");
    expect(markdown).toContain("## Claude\n\n<details>");
    expect(markdown).toContain("Start with the narrowest useful version.");
    expect(markdown).toContain("* Test it with one real page.");
    expect(markdown).toContain("```");
    expect(markdown).toContain("## User\n\nNow add a table.");
    expect(markdown).toContain("| Item | Status |");
  });

  it("expands thinking traces and nested show-more content before extracting", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
    await window.claudescraper.expandClaudeContent(document, window);
    const markdown = window.claudescraper.extractConversation(document);

    expect(markdown).toContain("<summary>Checked assumptions before answering</summary>");
    expect(markdown).toContain("> First I checked the brief.");
    expect(markdown).toContain(
      "> * [What is llms.txt? How the New AI Standard Works (2026 Guide)](https://www.bluehost.com/blog/what-is-llms-txt/) - www.bluehost.com",
    );
    expect(markdown).toContain(
      "> * [LLMS.txt 2026 Guide AI Agents & GEO Optimization](https://webscraft.org/blog/llmstxt-povniy-gayd-dlya-vebrozrobnikiv-2026?lang=en) - webscraft.org",
    );
    expect(markdown).not.toContain("www.bluehost.com](https://www.bluehost.com/blog/what-is-llms-txt/)[LLMS.txt");
    expect(markdown).toContain("> Then I compared the options.");
    expect(markdown).toContain("> Nested hidden rationale.");
    expect(markdown).toContain("<summary>Called tool: Bash</summary>");
    expect(markdown).toContain('Request\n\n```\n{\n  "commands": "printf \'Now: \'; date"\n}');
    expect(markdown).toContain("Response\n\n```\nNow: Sat May 16 12:28:03 PM +08 2026");
    expect(markdown).toContain("The preserved answer is inside the same grid as the thinking trace.");
  });

  it("does not require Claude CSS classes for turn boundaries", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
    document.querySelectorAll("[class]").forEach((node) => node.removeAttribute("class"));
    const markdown = window.claudescraper.extractConversation(document);

    expect(markdown).toContain("## User\n\nGive me a short plan.");
    expect(markdown).toContain("## Claude\n\n<details>");
    expect(markdown).toContain("Start with the narrowest useful version.");
  });
});

describe("chatgptscraper conversation extraction", () => {
  it("extracts semantic ChatGPT turns without action controls", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/chatgpt-basic.html");
    const ogTitle = document.createElement("meta");
    ogTitle.setAttribute("property", "og:title");
    ogTitle.content = "ChatGPT";
    document.head.appendChild(ogTitle);
    document.querySelector('[data-message-author-role="assistant"] .markdown').insertAdjacentHTML(
      "beforeend",
      `<div>Inspecting files</div>
      <div>Called toolCalled tool</div>
      <pre class="overflow-visible"><div><div>Python</div><button>Run</button><pre><code><span>bash -lc ls -la</span><br><span>printf done</span></code></pre></div></pre>`,
    );
    const markdown = window.chatgptscraper.extractConversation(document);

    expect(markdown).toContain('title: "ChatGPT Fixture"');
    expect(markdown).toContain("## User\n\nGive me a compact table.");
    expect(markdown).toContain("## ChatGPT\n\nI will answer directly.");
    expect(markdown).toContain("| Tool | Use |");
    expect(markdown).toContain("<summary>Called tool: Local MCP - Bash</summary>");
    expect(markdown).toContain("Request\n\n```\n{commands:");
    expect(markdown).toContain("Response\n\n```\n{result:");
    expect(markdown).toMatch(/Inspecting files\s+```\nbash -lc ls -la\nprintf done\n```/);
    expect(markdown).not.toContain("Pythonbash -lc");
    expect(markdown).not.toContain("Called toolCalled tool");
    expect(markdown).toContain("```");
    expect(markdown).not.toContain("Copy response");
    expect(markdown).not.toContain("More actions");
  });

  it("expands ChatGPT show-more and reasoning controls before extracting", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/chatgpt-basic.html");
    await window.chatgptscraper.expandChatGPTContent(document, window);
    const markdown = window.chatgptscraper.extractConversation(document);

    expect(markdown).toContain("Include code too.");
    expect(markdown).toContain("<summary>Thought for 12s</summary>");
    expect(markdown).toContain("I checked the sidebar trace.");
    expect(markdown).toContain("Then I wrote the answer.");
    expect(markdown).toContain("I inspected every activity.");
    expect(markdown).toContain("<summary>Inspected the data with Python</summary>");
    expect(markdown).toContain("Inspected and analyzed fixture data.");
    expect(markdown).toContain('```\nimport zipfile, os\nprint("done")\n```');
    expect(markdown).toContain("I kept the earlier reasoning after opening this section.");
  });

  it("does not require ChatGPT CSS classes for turn boundaries", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/chatgpt-basic.html");
    document.querySelectorAll("[class]").forEach((node) => node.removeAttribute("class"));
    const markdown = window.chatgptscraper.extractConversation(document);

    expect(markdown).toContain("## User\n\nGive me a compact table.");
    expect(markdown).toContain("## ChatGPT\n\nI will answer directly.");
    expect(markdown).toContain("<summary>Called tool: Local MCP - Bash</summary>");
    expect(markdown).toContain("Request\n\n```\n{commands:");
  });
});

describe("geminiscraper user formatting", () => {
  it("treats user paragraphs as single line breaks", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/user-paragraphs.html");
    const markdown = window.geminiscraper.extractConversation(document);
    expect(markdown).toContain("## User\n\nFirst line\nSecond line\n\n");
  });
});
