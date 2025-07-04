import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm, strikethrough, tables, taskListItems } from "@joplin/turndown-plugin-gfm";

/**
 * Converts current page or selected text to Markdown and copies to clipboard
 * @returns {Promise<void>}
 */
export async function convert() {
  try {
    // Get selected HTML or use entire document
    const selection = window.getSelection();
    let content = "";

    if (selection && selection.toString().trim()) {
      const container = document.createElement("div");
      const range = selection.getRangeAt(0);
      container.appendChild(range.cloneContents());
      cleanUp(container);
      content = container.innerHTML;
    } else {
      const documentClone = document.cloneNode(true);
      cleanUp(documentClone);
      const article = new Readability(documentClone).parse();
      content = article.content;
    }
    // If Readability fails, use the entire document
    if (!content) content = document.body.innerHTML;

    // Convert to Markdown
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      hr: "---",
    });
    turndownService.use(gfm);
    turndownService.use(strikethrough);
    turndownService.use(tables);
    turndownService.use(taskListItems);
    turndownService.addRule("svg", {
      filter: (n) => n.nodeName.toLowerCase() === "svg",
      replacement: (c, n) => n.outerHTML,
    });

    const markdown = turndownService.turndown(content);

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(markdown);
      alert("Markdown copied to clipboard");
    } catch {
      // Fallback to creating a temporary textarea element
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (success) alert("Markdown copied to clipboard");
      else throw new Error("Failed to copy to clipboard");
    }
  } catch (error) {
    alert(`Error converting page: ${error.message}`);
    throw error;
  }
}

/**
 * Cleans up the given element
 * @param {HTMLElement} container - The element to clean
 */
function cleanUp(container) {
  // Handle ChatGPT specific Markdown to HTML conversions
  if (location.hostname === "chatgpt.com") {
    // Convert citations [data-state="closed"] to comments
    container.querySelectorAll('[data-state="closed"]').forEach((el) => {
      el.parentNode.replaceChild(document.createComment(el.textContent), el);
    });

    // Parse code blocks. Hoist any `pre code` under the pre and drop the rest.
    container.querySelectorAll("pre").forEach((pre) => {
      // Already has a <code> child, nothing to do
      if (pre.children.length === 1 && pre.firstElementChild.tagName === "CODE") return;
      // Use existing <code> if present, or create a new one
      const code = pre.querySelector("code") ?? document.createElement("code");
      // move (not clone) nodes, keeping listeners
      if (!code.parentNode) while (pre.firstChild) code.appendChild(pre.firstChild);
      pre.replaceChildren(code); // nuke leftovers, keep attrs
    });
  }

  // Removes favicons and images with empty or short alt attributes
  container.querySelectorAll("img").forEach((img) => {
    if (!img.alt || img.alt.length < 3 || img.alt == "Favicon") img.remove();
  });

  // Removes links without text content, e.g. <a id="#">...</a>
  container.querySelectorAll("a").forEach((a) => {
    if (!a.textContent) a.remove();
    a.textContent = a.textContent.trim();
  });
}
