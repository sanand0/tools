(function () {
  const CDN = {
    marked: "https://cdn.jsdelivr.net/npm/marked@16.4.0/lib/marked.umd.js",
    highlight: "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/highlight.min.js",
    highlightCss: "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css",
  };

  const escapeScriptText = (value) => JSON.stringify(value).replace(/<\/script/gi, "<\\/script");

  const extractMarkdownSource = (doc = document, win = window) => {
    const selection = win.getSelection?.()?.toString()?.trim() || "";
    const markdown = selection || doc.body?.innerText || doc.documentElement?.innerText || doc.body?.textContent || "";
    return {
      markdown: markdown.trim(),
      isSelection: Boolean(selection),
      sourceUrl: win.location?.href || doc.location?.href || "",
      title: doc.title?.trim() || "Markdown View",
    };
  };

  const buildPopupHtml = ({ markdown, title, sourceUrl, isSelection }) => {
    const safeMarkdown = escapeScriptText(markdown);
    const safeTitle = escapeScriptText(title);
    const safeSourceUrl = escapeScriptText(sourceUrl);
    const status = isSelection ? "Selection rendered as Markdown" : "Page rendered as Markdown";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, "&lt;")} · Markdown View</title>
  <link rel="stylesheet" href="${CDN.highlightCss}">
  <style>
    :root { color-scheme: dark; --bg: #0f172a; --panel: rgba(15, 23, 42, 0.88); --panel-border: rgba(148, 163, 184, 0.18); --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; --code-bg: #020617; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif; color: var(--text); background: radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 35%), linear-gradient(160deg, #020617 0%, #0f172a 45%, #111827 100%); }
    .shell { width: min(960px, calc(100vw - 32px)); margin: 24px auto; padding: 24px; border: 1px solid var(--panel-border); border-radius: 24px; background: var(--panel); backdrop-filter: blur(14px); box-shadow: 0 24px 60px rgba(2, 6, 23, 0.45); }
    .eyebrow { margin: 0 0 8px; font: 600 0.82rem/1.4 "IBM Plex Sans", "Segoe UI", sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
    h1 { margin: 0; font-size: clamp(2rem, 4vw, 3.25rem); line-height: 1.05; }
    .meta { margin: 12px 0 0; color: var(--muted); font: 500 0.98rem/1.6 "IBM Plex Sans", "Segoe UI", sans-serif; }
    .meta a { color: inherit; word-break: break-all; }
    .divider { height: 1px; margin: 20px 0 24px; background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.35), transparent); border: 0; }
    .markdown-body { font-size: 1.1rem; line-height: 1.75; }
    .markdown-body :first-child { margin-top: 0; }
    .markdown-body pre { padding: 18px; overflow-x: auto; border-radius: 16px; background: var(--code-bg); border: 1px solid rgba(148, 163, 184, 0.14); }
    .markdown-body code { font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace; font-size: 0.92em; }
    .markdown-body :not(pre) > code { padding: 0.15em 0.4em; border-radius: 8px; background: rgba(15, 23, 42, 0.8); }
    .markdown-body blockquote { margin-left: 0; padding-left: 18px; border-left: 4px solid rgba(56, 189, 248, 0.65); color: #cbd5e1; }
    .markdown-body table { width: 100%; border-collapse: collapse; }
    .markdown-body th, .markdown-body td { padding: 10px 12px; border: 1px solid rgba(148, 163, 184, 0.2); }
    .markdown-body img { max-width: 100%; border-radius: 14px; }
  </style>
</head>
<body>
  <main class="shell">
    <p class="eyebrow">${status}</p>
    <h1 id="page-title"></h1>
    <p class="meta">Source: <a id="source-link" rel="noreferrer noopener" target="_blank"></a></p>
    <hr class="divider">
    <article id="markdown-root" class="markdown-body"></article>
  </main>
  <script src="${CDN.marked}"></script>
  <script src="${CDN.highlight}"></script>
  <script>
    const markdown = ${safeMarkdown};
    const title = ${safeTitle};
    const sourceUrl = ${safeSourceUrl};
    document.getElementById("page-title").textContent = title;
    const sourceLink = document.getElementById("source-link");
    sourceLink.textContent = sourceUrl;
    sourceLink.href = sourceUrl;
    document.getElementById("markdown-root").innerHTML = marked.parse(markdown, { gfm: true, breaks: false });
    document.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
  </script>
</body>
</html>`;
  };

  const openPopup = (payload, win = window) => {
    const popup = win.open("", "_blank", "popup=yes,width=1100,height=800,scrollbars=yes,resizable=yes");
    if (!popup) return null;
    popup.document.open();
    popup.document.write(buildPopupHtml(payload));
    popup.document.close();
    popup.focus?.();
    return popup;
  };

  const showPopup = (doc = document, win = window) => openPopup(extractMarkdownSource(doc, win), win);

  window.mdview = { extractMarkdownSource, buildPopupHtml, openPopup, showPopup };
})();
