import { describe, it, expect, beforeEach, vi } from "vitest";
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
    document.querySelector(".font-claude-response").insertAdjacentHTML(
      "beforeend",
      '<button aria-expanded="false" aria-label="More ways to open">Open artifact</button>',
    );
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
    expect(document.querySelector('[aria-label="More ways to open"]').getAttribute("aria-expanded")).toBe("false");
  });

  it("does not require Claude CSS classes for turn boundaries", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
    document.querySelectorAll("[class]").forEach((node) => node.removeAttribute("class"));
    const markdown = window.claudescraper.extractConversation(document);

    expect(markdown).toContain("## User\n\nGive me a short plan.");
    expect(markdown).toContain("## Claude\n\n<details>");
    expect(markdown).toContain("Start with the narrowest useful version.");
  });

  it("keeps transcript rows revealed by user scrolling", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
    const row = (index, role, text) => `
      <div data-testid="transcript-row" data-index="${index}" data-perf-row="${role}">
        <div data-testid="${role === "human" ? "user-message" : "assistant-message"}" data-is-streaming="false">
          <div class="font-claude-response"><p>${text}</p></div>
        </div>
      </div>`;
    document.body.innerHTML = `
      <header><button data-testid="chat-title-button">Virtualized Claude</button></header>
      <main>${row(0, "human", "First question.")}${row(1, "assistant", "First answer.")}</main>`;
    window.alert = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clearIntervalFn = vi.fn();
    const state = window.claudescraper.createScraperState(document);
    let refresh;
    window.claudescraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      (callback) => {
        refresh = callback;
        return 42;
      },
      clearIntervalFn,
    );
    await Promise.resolve();
    expect(document.getElementById("claudescraper-copy-markdown-btn").textContent).toBe(
      "Copy 2 messages as Markdown",
    );
    expect(document.getElementById("claudescraper-copy-json-btn").textContent).toBe(
      "Copy 2 messages as JSON",
    );
    expect(document.getElementById("claudescraper-copy-prompts-btn").textContent).toBe(
      "Copy 1 prompts",
    );
    expect(document.getElementById("claudescraper-copy-controls").getAttribute("style")).toContain("font:12px");
    expect(document.getElementById("claudescraper-copy-json-btn").getAttribute("style")).toContain("background:#0d6efd");
    expect(document.getElementById("claudescraper-copy-close-btn").getAttribute("style")).toContain("background:#dc3545");
    expect(document.getElementById("claudescraper-copy-close-btn").getAttribute("style")).toContain("padding:2px 10px");

    document.querySelector('[data-index="0"]').remove();
    document.querySelector("main").insertAdjacentHTML("beforeend", row(2, "human", "Second question."));
    refresh();
    await Promise.resolve();
    expect(state.rows).toHaveLength(3);
    expect(state.rows.map((item) => item.dataset.index)).toEqual(["0", "1", "2"]);

    document.getElementById("claudescraper-copy-markdown-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("First question."));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Second question."));
    expect(writeText.mock.calls[0][0].indexOf("First question.")).toBeLessThan(
      writeText.mock.calls[0][0].indexOf("First answer."),
    );
    expect(writeText.mock.calls[0][0].indexOf("First answer.")).toBeLessThan(
      writeText.mock.calls[0][0].indexOf("Second question."),
    );
    expect(window.alert).not.toHaveBeenCalled();
    expect(document.getElementById("claudescraper-copy-controls")).not.toBeNull();
    document.getElementById("claudescraper-copy-close-btn").click();
    expect(clearIntervalFn).toHaveBeenCalledWith(42);
    expect(state.active).toBe(false);
    expect(document.getElementById("claudescraper-copy-controls")).toBeNull();
  });

  it("copies Claude JSON and prompts in the ChatGPT scraper format", async () => {
    const createPage = async () => {
      const loaded = await loadFrom(import.meta.dirname, "__fixtures__/claude-basic.html");
      loaded.document.body.innerHTML = `
        <header><button data-testid="chat-title-button">Virtualized Claude</button></header>
        <main>
          <div data-testid="transcript-row" data-index="0" data-perf-row="human">
            <div data-testid="user-message"><p>First question.</p></div>
          </div>
          <div data-testid="transcript-row" data-index="1" data-perf-row="assistant">
            <div data-testid="assistant-message" data-is-streaming="false"><div class="font-claude-response"><p>First answer.</p></div></div>
          </div>
          <div data-testid="transcript-row" data-index="2" data-perf-row="human">
            <div data-testid="user-message"><p>Second question.</p></div>
          </div>
        </main>`;
      loaded.window.alert = vi.fn();
      return loaded;
    };

    const jsonPage = await createPage();
    const jsonWriteText = vi.fn().mockResolvedValue(undefined);
    jsonPage.window.claudescraper.scrape(
      jsonPage.document,
      jsonPage.window,
      { clipboard: { writeText: jsonWriteText } },
      jsonPage.window.claudescraper.createScraperState(jsonPage.document),
      () => 1,
      vi.fn(),
    );
    jsonPage.document.getElementById("claudescraper-copy-json-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(jsonWriteText.mock.calls[0][0])).toEqual([
      { id: "0", role: "user", content: "First question." },
      { id: "1", role: "assistant", content: "First answer." },
      { id: "2", role: "user", content: "Second question." },
    ]);
    expect(jsonPage.document.getElementById("claudescraper-copy-controls")).not.toBeNull();
    jsonPage.document.getElementById("claudescraper-copy-close-btn").click();
    expect(jsonPage.document.getElementById("claudescraper-copy-controls")).toBeNull();

    const promptsPage = await createPage();
    const promptWriteText = vi.fn().mockResolvedValue(undefined);
    promptsPage.window.claudescraper.scrape(
      promptsPage.document,
      promptsPage.window,
      { clipboard: { writeText: promptWriteText } },
      promptsPage.window.claudescraper.createScraperState(promptsPage.document),
      () => 1,
      vi.fn(),
    );
    promptsPage.document.getElementById("claudescraper-copy-prompts-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(promptWriteText.mock.calls[0][0]).toContain("<!-- Virtualized Claude: ");
    expect(promptWriteText.mock.calls[0][0]).toContain("First question.\n\n---\n\nSecond question.");
    expect(promptWriteText.mock.calls[0][0]).not.toContain("First answer.");
  });
});

describe("chatgptscraper conversation extraction", () => {
  const flattenParts = (parts) =>
    parts.flatMap((part) => [part, ...flattenParts(part.children || [])]);

  it("exports rich response components as readable Markdown and ordered semantic JSON", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-rich.html",
    );
    const before = document.querySelector("main").outerHTML;
    const messages = window.chatgptscraper.extractMessages(document);
    const answer = messages[1];
    const parts = flattenParts(answer.parts);

    expect(messages.map(({ id, role }) => [id, role])).toEqual([
      ["rich-user", "user"],
      ["rich-assistant", "assistant"],
    ]);
    expect(answer.content).toContain("Choose **carefully**.");
    expect(answer.content).toContain("* Option A cost: **100**");
    expect(answer.content).toContain("* Option B cost: **150**");
    expect(answer.content).not.toContain("# 100");
    expect(answer.content).toContain("Speed — **5**");
    expect(answer.content).toContain("| A | 100 |");
    expect(answer.content).toContain(
      "Chart: Chart chart\n* Option A: Cost index 100, Speed index 100",
    );
    expect(answer.content).toContain("$\\Delta C = 50$");
    expect(answer.content).toContain("Incremental cost: $\\Delta C = 50$.");
    expect(answer.content).toContain(
      "$$\n\\frac{5-3}{3}\\times100\\% = 66.7\\%\n$$",
    );
    expect(answer.content).toContain("* [x] Compare costs");
    expect(answer.content).toContain("* [ ] Confirm budget");
    expect(answer.content).toContain(
      "3. Establish constraints\n  \n  * Determine budget",
    );
    expect(answer.content).toContain("> The fastest option");
    expect(answer.content).toContain("Speed is comparable.");
    expect(answer.content).toContain(
      '```python\noptions = {"A": 100, "B": 150}\n\nfor name, cost in options.items():\n    print(name, cost)\n```',
    );
    expect(answer.content).toContain(
      "Download fictional_options.csv (link: target not exposed)",
    );
    expect(answer.content).toContain(
      "OpenAI Help Center (+1 more sources) (source: target not exposed)",
    );
    expect(answer.content).toContain(
      "See Example.com (link: target not exposed) and OpenAI Help Center",
    );
    expect(answer.content).toContain("[Image unavailable]");
    expect(answer.content).toContain(
      "![Fictional comparison](https://example.com/result.png)",
    );
    expect(answer.content).toContain(
      "Unknown component still has readable text.",
    );
    expect(answer.content).toContain("Action: Build a decision model");
    expect(answer.content).not.toMatch(
      /Worked for|Duplicated formula|Run\n|Share controls|Hidden unrelated|favicon/,
    );
    expect(parts).toContainEqual({
      type: "metric",
      label: "Option A cost",
      value: "100",
    });
    expect(parts).toContainEqual({
      type: "checkbox",
      label: "Confirm budget",
      checked: false,
    });
    expect(parts).toContainEqual({
      type: "citation",
      label: "OpenAI Help Center",
      additionalSources: 1,
      unresolved: true,
    });
    expect(parts).toContainEqual({
      type: "file",
      label: "Download fictional_options.csv",
      name: "fictional_options.csv",
      unresolved: true,
    });
    expect(parts).toContainEqual({
      type: "action",
      label: "Build a decision model",
    });
    expect(parts.find((part) => part.type === "chart").summary).toEqual([
      "Option A: Cost index 100, Speed index 100",
      "Option B: Cost index 150, Speed index 166.7",
    ]);
    expect(parts.find((part) => part.type === "table").rows).toEqual([
      ["Option", "Cost"],
      ["A", "100"],
      ["B", "150"],
    ]);
    expect(parts.find((part) => part.type === "code")).toMatchObject({
      language: "python",
      code: expect.stringContaining("    print(name, cost)"),
    });
    expect(parts.find((part) => part.type === "math")).toMatchObject({
      latex: "\\Delta C = 50",
      display: false,
    });
    expect(parts.some((part) => part.component === "future-card")).toBe(true);
    expect(document.querySelector("main").outerHTML).toBe(before);
  });

  it("resolves only associated open link previews and retains their URLs when closed", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-rich.html",
    );
    const trigger = document.querySelector(
      '[data-d-component="popover-trigger"][role="link"]',
    );
    trigger.setAttribute("aria-controls", "example-preview");
    trigger.setAttribute("aria-expanded", "true");
    document
      .querySelector('section[aria-label="Chart chart"]')
      .insertAdjacentHTML(
        "afterbegin",
        '<span data-d-component="popover-trigger" role="link" aria-controls="chart-preview">Chart reference</span>',
      );
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="dialog" id="example-preview"><span role="button" aria-label="https://example.com/">https://example.com/...</span></div><div role="dialog" id="chart-preview"><a href="https://chart.example/">Chart source</a></div><div role="dialog"><a href="https://unrelated.example/">Unrelated</a></div>',
    );
    const click = vi.spyOn(trigger, "click");
    const extract = () => window.chatgptscraper.extractMessages(document)[1];
    expect(flattenParts(extract().parts)).toContainEqual({
      type: "link",
      label: "Example.com",
      url: "https://example.com/",
    });
    document.getElementById("example-preview").remove();
    trigger.removeAttribute("aria-controls");
    trigger.setAttribute("aria-expanded", "false");
    expect(extract().content).toContain("[Example.com](https://example.com/)");
    expect(extract().content).not.toContain("https://unrelated.example/");
    const remounted = trigger.cloneNode(true);
    trigger.replaceWith(remounted);
    expect(extract().content).toContain("[Example.com](https://example.com/)");
    remounted.replaceWith(trigger);
    trigger.textContent = "Different source in recycled node";
    expect(flattenParts(extract().parts)).toContainEqual({
      type: "link",
      label: "Different source in recycled node",
      unresolved: true,
    });
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("retains source-card titles exposed by a citation preview without inventing URLs", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-rich.html",
    );
    const trigger = document.querySelector(
      '[data-d-component="popover-trigger"][role="button"]',
    );
    trigger.setAttribute("aria-controls", "source-preview");
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="source-preview" role="dialog"><div data-d-component="col">
      <button data-d-component="pressable" aria-label="Open OpenAI"><span data-d-component="text">OpenAI</span><span data-d-component="text">Search documentation</span></button>
      <button data-d-component="pressable" aria-label="Open Example"><span data-d-component="text">Example</span><span data-d-component="text">Another resource</span></button>
    </div></div>`,
    );
    const answer = window.chatgptscraper.extractMessages(document)[1];
    expect(
      flattenParts(answer.parts).find((part) => part.type === "citation")
        .sources,
    ).toEqual([
      { label: "OpenAI — Search documentation", unresolved: true },
      { label: "Example — Another resource", unresolved: true },
    ]);
    expect(answer.content).toContain(
      "Sources: OpenAI — Search documentation; Example — Another resource",
    );
  });

  it("exports chart-only messages with their semantic parts", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-rich.html",
    );
    const answer = document.querySelector(
      '[data-markdown-text-style="assistant-message"]',
    );
    const chart = answer.querySelector('section[aria-label="Chart chart"]');
    answer.replaceChildren(chart);
    const message = window.chatgptscraper.extractMessages(document)[1];
    expect(message.parts).toEqual([
      expect.objectContaining({
        type: "chart",
        summary: expect.arrayContaining([
          "Option B: Cost index 150, Speed index 166.7",
        ]),
        caption: "Option A = 100 for each metric",
      }),
    ]);
  });

  it("copies rich JSON without losing parts while virtualized turns disappear", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-rich.html",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const state = window.chatgptscraper.createScraperState(document);
    window.chatgptscraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      () => 1,
      vi.fn(),
    );
    const captured = JSON.stringify(state.messages);
    document
      .querySelector('[data-content-search-turn-key="turn-rich"]')
      .remove();
    document.getElementById("chatgptscraper-copy-json-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(
      JSON.parse(captured),
    );
    expect(
      flattenParts(JSON.parse(writeText.mock.calls[0][0])[1].parts),
    ).toContainEqual({ type: "action", label: "Build a decision model" });
    document.getElementById("chatgptscraper-copy-close-btn").click();
  });

  it("extracts ChatGPT's current semantic message DOM", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-current-dom.html",
    );
    const messages = window.chatgptscraper.extractMessages(document);

    expect(
      document.querySelectorAll("[data-message-author-role]"),
    ).toHaveLength(0);
    expect(messages).toEqual([
      {
        id: "user-a",
        role: "user",
        content: "First question with **emphasis**.",
        timestamp: "2026-09-26T08:00:00.000Z",
      },
      {
        id: "assistant-a",
        role: "assistant",
        content: "First answer.\n\n\n```\nconst answer = true;\n```",
        timestamp: "2026-09-26T08:00:00.000Z",
      },
      {
        id: "user-b",
        role: "user",
        content: "Second question.",
        timestamp: "2026-09-26T08:01:00.000Z",
      },
      {
        id: "assistant-b",
        role: "assistant",
        content: "Second answer.",
        timestamp: "2026-09-26T08:01:00.000Z",
      },
    ]);
  });

  it("extracts semantic ChatGPT turns as copy-button-equivalent Markdown", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    const ogTitle = document.createElement("meta");
    ogTitle.setAttribute("property", "og:title");
    ogTitle.content = "ChatGPT";
    document.head.appendChild(ogTitle);
    document
      .querySelector("[data-testid='conversation-turn-1']")
      .insertAdjacentHTML(
        "beforeend",
        '<time datetime="2026-08-27T09:10:11.000Z"></time>',
      );
    document
      .querySelector("[data-testid='conversation-turn-2']")
      .insertAdjacentHTML(
        "beforeend",
        '<time datetime="2026-08-27T09:11:12.000Z"></time>',
      );
    document
      .querySelector('[data-message-author-role="assistant"] .markdown')
      .insertAdjacentHTML(
        "beforeend",
        `<div>Inspecting files</div>
      <div>Called toolCalled tool</div>
      <pre class="overflow-visible"><div><div>Python</div><button>Run</button><pre><code><span>bash -lc ls -la</span><br><span>printf done</span></code></pre></div></pre>
      <div data-testid="writing-block-container"><div contenteditable="true"><p>Before answering, test the framing.</p><p>When reframing, write <code>Reframed question: …</code> in one concise sentence.</p></div></div>`,
      );
    const markdown = window.chatgptscraper.extractConversation(document);

    expect(markdown).toMatch(
      /^---\ntitle: "ChatGPT Fixture"\ndate: .+\nsource: "https:\/\/test\/aiscrapers\/__fixtures__\/chatgpt-basic.html"\n---\n\n# User\n\n_2026-08-27T09:10:11.000Z_\n\n/,
    );
    expect(markdown).toContain(
      "# User\n\n_2026-08-27T09:10:11.000Z_\n\n* Attachment: browsing-history.tsv(1).xz (File)\n\nGive me a compact table.\n\nKeep **this emphasis** and `this code`.\n\n* First item\n* Second item\n\nInclude code too.",
    );
    expect(markdown).not.toContain("\n\nFile\n\nGive me a compact table.");
    expect(markdown).toContain(
      "# ChatGPT\n\n_2026-08-27T09:11:12.000Z_\n\nI will answer directly.",
    );
    expect(markdown).toContain("| Tool | Use |");
    expect(markdown).toContain(
      "<summary>Called tool: Local MCP - Bash</summary>",
    );
    expect(markdown).toContain("Request\n\n```\n{commands:");
    expect(markdown).toContain("Response\n\n```\n{result:");
    expect(markdown).toMatch(
      /Inspecting files\s+```\nbash -lc ls -la\nprintf done\n```/,
    );
    expect(markdown).not.toContain("Pythonbash -lc");
    expect(markdown).not.toContain("Called toolCalled tool");
    expect(markdown).toContain("Before answering, test the framing.");
    expect(markdown).toContain(
      "When reframing, write `Reframed question: …` in one concise sentence.",
    );
    expect(markdown).toContain("```");
    expect(markdown).not.toContain("Copy response");
    expect(markdown).not.toContain("More actions");
    expect(markdown).not.toContain("Thought for 12s");
    expect(markdown).not.toContain("Worked for 1m");
    expect(markdown.match(/^title:/gm)).toHaveLength(1);
  });

  it("does not click or capture reasoning controls", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const state = window.chatgptscraper.createScraperState();
    window.chatgptscraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      () => 1,
      vi.fn(),
    );

    expect(
      document.querySelector(".reasoning-toggle").getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      document.querySelector("[aria-label='Reasoning details']"),
    ).toBeNull();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).not.toContain("Thought for 12s");
    expect(state.messages[1].content).not.toContain(
      "I checked the shape first.",
    );
  });

  it("does not require ChatGPT CSS classes for turn boundaries", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    document
      .querySelectorAll("[class]")
      .forEach((node) => node.removeAttribute("class"));
    const markdown = window.chatgptscraper.extractConversation(document);

    expect(markdown).toContain(
      "# User\n\n* Attachment: browsing-history.tsv(1).xz (File)\n\nGive me a compact table.",
    );
    expect(markdown).toContain("# ChatGPT\n\nI will answer directly.");
    expect(markdown).toContain(
      "<summary>Called tool: Local MCP - Bash</summary>",
    );
    expect(markdown).toContain("Request\n\n```\n{commands:");
  });

  it("accumulates newly revealed turns and copies Markdown or JSON", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    let capture;
    const clearIntervalFn = vi.fn();
    const state = window.chatgptscraper.createScraperState();
    window.chatgptscraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      (callback) => {
        capture = callback;
        return 42;
      },
      clearIntervalFn,
    );

    expect(
      document.getElementById("chatgptscraper-copy-markdown-btn").textContent,
    ).toBe("Copy 2 messages as Markdown");
    expect(
      document.getElementById("chatgptscraper-copy-json-btn").textContent,
    ).toBe("Copy 2 messages as JSON");
    expect(document.getElementById("chatgptscraper-copy-controls").getAttribute("style")).toContain("font:12px");
    expect(document.getElementById("chatgptscraper-copy-markdown-btn").getAttribute("style")).toContain("background:#0d6efd");
    expect(document.getElementById("chatgptscraper-copy-close-btn").getAttribute("style")).toContain("background:#dc3545");
    expect(document.getElementById("chatgptscraper-copy-close-btn").getAttribute("style")).toContain("padding:2px 10px");
    expect(
      document.getElementById("chatgptscraper-copy-close-btn").textContent,
    ).toBe("×");

    document.querySelector("main").insertAdjacentHTML(
      "beforeend",
      `<section data-testid="conversation-turn-3">
        <div data-message-id="message-3" data-message-author-role="user"><p>Newly revealed question.</p></div>
        <button aria-label="Copy message"></button>
      </section>`,
    );
    capture();
    capture();

    expect(state.messages).toHaveLength(3);
    expect(
      document.getElementById("chatgptscraper-copy-json-btn").textContent,
    ).toBe("Copy 3 messages as JSON");
    document.querySelector("[data-testid='conversation-turn-1']").remove();
    capture();
    expect(state.messages).toHaveLength(3);
    await state.timestampsPromise;
    document.getElementById("chatgptscraper-copy-json-btn").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual([
      expect.objectContaining({ id: "conversation-turn-1", role: "user" }),
      expect.objectContaining({ id: "conversation-turn-2", role: "assistant" }),
      {
        id: "message-3",
        role: "user",
        content: "Newly revealed question.",
      },
    ]);
    await vi.waitFor(() => expect(document.getElementById("chatgptscraper-copy-json-btn").textContent).toBe("Copied"));
    expect(clearIntervalFn).not.toHaveBeenCalledWith(42);
    expect(document.getElementById("chatgptscraper-copy-controls")).not.toBeNull();
    document.getElementById("chatgptscraper-copy-close-btn").click();
    expect(clearIntervalFn).toHaveBeenCalledWith(42);
    expect(document.getElementById("chatgptscraper-copy-controls")).toBeNull();
  });

  it("copies only user prompts with a metadata comment and separators", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    document.querySelector("main").insertAdjacentHTML(
      "beforeend",
      `<section data-testid="conversation-turn-3">
        <div data-message-id="message-3" data-message-author-role="user"><p>Follow-up question.</p></div>
      </section>`,
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const state = window.chatgptscraper.createScraperState(document);
    window.chatgptscraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      () => 11,
      vi.fn(),
    );

    const button = document.getElementById("chatgptscraper-copy-prompts-btn");
    expect(button.textContent).toBe("Copy 2 prompts");
    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(
      `<!-- ChatGPT Fixture: ${window.location.href} (${state.metadata.date}) -->\n\n` +
        `${state.messages[0].content}\n\n---\n\nFollow-up question.\n`,
    );
    expect(writeText.mock.calls[0][0]).not.toContain("I will answer directly.");
    expect(writeText.mock.calls[0][0]).not.toContain("# User");
    expect(writeText.mock.calls[0][0]).not.toContain("# ChatGPT");
  });

  it("orders immutable message IDs when pagination reindexes turn containers", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    const [user, assistant] = document.querySelectorAll(
      "[data-message-author-role]",
    );
    user.setAttribute("data-message-id", "latest-user");
    assistant.setAttribute("data-message-id", "latest-assistant");
    const state = window.chatgptscraper.createScraperState();
    window.chatgptscraper.captureMessages(document, state);

    user.closest("section").setAttribute("data-testid", "conversation-turn-11");
    assistant
      .closest("section")
      .setAttribute("data-testid", "conversation-turn-12");
    user
      .closest("section")
      .insertAdjacentHTML(
        "beforebegin",
        `<section data-testid="conversation-turn-2"><div data-message-id="earlier-assistant" data-message-author-role="assistant"><div class="markdown"><p>Earlier answer.</p></div></div></section>`,
      );
    document
      .querySelector("[data-message-id='earlier-assistant']")
      .closest("section")
      .insertAdjacentHTML(
        "beforebegin",
        `<section data-testid="conversation-turn-1"><div data-message-id="earlier-user" data-message-author-role="user"><p>Earlier question.</p></div></section>`,
      );
    window.chatgptscraper.captureMessages(document, state);

    expect(state.messages.map(({ id }) => id)).toEqual([
      "earlier-user",
      "earlier-assistant",
      "latest-user",
      "latest-assistant",
    ]);
  });

  it("enriches Markdown and JSON with API timestamps when available", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    const [user, assistant] = document.querySelectorAll(
      "[data-message-author-role]",
    );
    window.history.replaceState({}, "", "/c/conversation-id");
    user.setAttribute("data-message-id", "user-message");
    assistant.setAttribute("data-message-id", "assistant-message");
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mapping: {
          user: { message: { id: "user-message", create_time: 1787821811 } },
          assistant: {
            message: { id: "assistant-message", create_time: 1787821872 },
          },
        },
      }),
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const state = window.chatgptscraper.createScraperState(document);
    window.chatgptscraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      () => 7,
      vi.fn(),
    );
    await state.timestampsPromise;

    expect(state.messages.map(({ timestamp }) => timestamp)).toEqual([
      "2026-08-27T09:10:11.000Z",
      "2026-08-27T09:11:12.000Z",
    ]);
    expect(
      window.chatgptscraper.messagesToMarkdown(state.messages, state.metadata),
    ).toContain("# User\n\n_2026-08-27T09:10:11.000Z_\n\n");
    document.getElementById("chatgptscraper-copy-json-btn").click();
    await Promise.resolve();
    expect(JSON.parse(writeText.mock.calls[0][0])[1]).toMatchObject({
      id: "assistant-message",
      timestamp: "2026-08-27T09:11:12.000Z",
    });
    expect(document.getElementById("chatgptscraper-copy-controls")).not.toBeNull();
    document.getElementById("chatgptscraper-copy-close-btn").click();
    expect(document.getElementById("chatgptscraper-copy-controls")).toBeNull();
  });

  it("keeps DOM extraction usable when timestamp APIs fail", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-basic.html",
    );
    window.history.replaceState({}, "", "/c/conversation-id");
    window.fetch = vi.fn().mockResolvedValue({ ok: false });

    const timestamps =
      await window.chatgptscraper.fetchMessageTimestamps(document);

    expect(timestamps.size).toBe(0);
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(window.chatgptscraper.extractConversation(document)).toContain(
      "# User\n\n* Attachment: browsing-history.tsv(1).xz (File)",
    );
  });
});

describe("ChatGPT sidebar scraper", () => {
  it("extracts chat titles and absolute URLs only from chat history", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-sidebar.html",
    );

    expect(window.chatgptSidebarScraper.extractChats(document)).toEqual([
      { title: "First chat", url: "https://test/c/chat-1" },
      {
        title: "Research [notes]",
        url: "https://test/g/project/c/chat-2?messageId=latest",
      },
    ]);
  });

  it("retains chats revealed after scrolling when earlier rows are virtualized", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-sidebar.html",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clearIntervalFn = vi.fn();
    let capture;
    const state = window.chatgptSidebarScraper.createScraperState();
    window.chatgptSidebarScraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      state,
      (callback) => {
        capture = callback;
        return 23;
      },
      clearIntervalFn,
    );

    expect(
      document.getElementById("chatgpt-sidebar-scraper-copy-json-btn")
        .textContent,
    ).toBe("Copy 2 chats as JSON");
    document.querySelector("nav").insertAdjacentHTML(
      "beforeend",
      '<a href="/c/chat-3" data-sidebar-item="true"><span data-marquee-text="true">Newly revealed chat</span></a>',
    );
    document.querySelector('a[href="/c/chat-1"]').remove();
    capture();

    expect(state.chats).toEqual([
      { title: "First chat", url: "https://test/c/chat-1" },
      {
        title: "Research [notes]",
        url: "https://test/g/project/c/chat-2?messageId=latest",
      },
      { title: "Newly revealed chat", url: "https://test/c/chat-3" },
    ]);
    document.getElementById("chatgpt-sidebar-scraper-copy-json-btn").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(state.chats);
    await vi.waitFor(() => expect(document.getElementById("chatgpt-sidebar-scraper-copy-json-btn").textContent).toBe("Copied"));
    expect(clearIntervalFn).not.toHaveBeenCalledWith(23);
    expect(
      document.getElementById("chatgpt-sidebar-scraper-copy-controls"),
    ).not.toBeNull();
    document.getElementById("chatgpt-sidebar-scraper-copy-close-btn").click();
    expect(clearIntervalFn).toHaveBeenCalledWith(23);
    expect(document.getElementById("chatgpt-sidebar-scraper-copy-controls")).toBeNull();
  });

  it("copies a Markdown list with escaped titles", async () => {
    const { window, document } = await loadFrom(
      import.meta.dirname,
      "__fixtures__/chatgpt-sidebar.html",
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.chatgptSidebarScraper.scrape(
      document,
      window,
      { clipboard: { writeText } },
      window.chatgptSidebarScraper.createScraperState(),
      () => 9,
      vi.fn(),
    );
    document
      .getElementById("chatgpt-sidebar-scraper-copy-markdown-btn")
      .click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(
      "- [First chat](https://test/c/chat-1)\n" +
        "- [Research \\[notes\\]](https://test/g/project/c/chat-2?messageId=latest)",
    );
  });
});

describe("geminiscraper user formatting", () => {
  it("treats user paragraphs as single line breaks", async () => {
    const { window, document } = await loadFrom(import.meta.dirname, "__fixtures__/user-paragraphs.html");
    const markdown = window.geminiscraper.extractConversation(document);
    expect(markdown).toContain("## User\n\nFirst line\nSecond line\n\n");
  });
});
