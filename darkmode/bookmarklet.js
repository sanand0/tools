// @ts-check
(() => {
  // Gmail uses these containers for received messages, including reading panes
  // and expanded conversations. Scope every rule here, away from lists/drafts.
  const gmailBody = '.ii.gt .a3s:not([contenteditable="true"])';
  // Exact hosts keep future site themes isolated; no requests run on the target site.
  const themes = {
    "news.ycombinator.com": {
      name: "Hacker News (news.ycombinator.com)",
      css: `
      html { color-scheme: dark !important; background: #141414 !important; }
      body { background: #141414 !important; color: #c8c8c8 !important; }
      #hnmain, [bgcolor] { background-color: #202020 !important; }
      body[bgcolor] { background-color: #141414 !important; }
      td, .default, .title, .subtext, .comhead, .yclinks, .pagetop,
      b, strong, font, [color] { color: #c8c8c8 !important; }
      .subtext, .subtext td, .comhead, .rank, .sitestr { color: #b8b8b8 !important; }
      a:link { color: #c8c8c8 !important; }
      a:visited { color: #bca9de !important; }
      .subtext a:link, .subtext a:visited, .comhead a:link, .comhead a:visited,
      .sitebit a:link, .sitebit a:visited { color: #b8b8b8 !important; }
      .comment a:link, .commtext a:link { color: #9dcbff !important; }
      .comment a:visited, .commtext a:visited { color: #bca9de !important; }
      /* Downvoted comments stay muted, but never fade below readable contrast. */
      .c00 { color: #c8c8c8 !important; }
      .c5a, .c73, .c82, .c88, .c9c, .cae, .cbe, .cce, .cdd {
        color: #b8b8b8 !important;
      }
      [bgcolor="#ff6600" i], [bgcolor="ff6600" i] { background-color: #ff6600 !important; }
      .pagetop, .pagetop a:link, .pagetop a:visited, .pagetop b {
        color: #141414 !important;
      }
      .topsel a { text-decoration: underline !important; }
      a:any-link:hover, a:any-link:active { color: #ffbd80 !important; text-decoration: underline !important; }
      .pagetop a:hover, .pagetop a:active { color: #141414 !important; }
      a:focus-visible, input:focus-visible, textarea:focus-visible,
      select:focus-visible, button:focus-visible {
        outline: 2px solid #ffbd80 !important; outline-offset: 2px !important;
      }
      .pagetop a:focus-visible { outline-color: #141414 !important; }
      input, textarea, select, button {
        color: #c8c8c8 !important; background-color: #292929 !important;
        border-color: #999999 !important; accent-color: #ffbd80 !important;
      }
      input::placeholder, textarea::placeholder { color: #b8b8b8 !important; opacity: 1 !important; }
      input:disabled, textarea:disabled, select:disabled, button:disabled, input[readonly] {
        color: #b8b8b8 !important; background-color: #202020 !important;
      }
      button:hover, input[type="submit"]:hover, input[type="button"]:hover {
        background-color: #404040 !important;
      }
      pre, code { color: #c8c8c8 !important; }
      hr { border-color: #999999 !important; }
      /* Brighten the existing vote icon, preserving rotation and hidden states. */
      .votearrow { filter: brightness(1.8); }
      a:hover .votearrow { filter: brightness(2.4); }
      ::selection { background: #ffbd80 !important; color: #141414 !important; }
      `,
    },
    "mail.google.com": {
      name: "Gmail (mail.google.com)",
      css: `
        /* The conversation surface surrounds the body with subject, sender,
           attachment and reply areas. Gmail's inbox uses a separate container. */
        .iY {
          color-scheme: dark !important;
          background-color: #202124 !important;
          color: #e8eaed !important;
        }
        .iY * {
          background-color: transparent !important;
          color: #e8eaed !important;
          border-color: #5f6368 !important;
        }
        .iY [role="button"]:hover, .iY [role="button"]:focus-visible {
          background-color: #303134 !important;
        }
        /* Gmail's monochrome sprite controls need light pixels; mail images
           and sender avatars keep their original colors. */
        .iY .ajz, .iY .iV { filter: brightness(0) invert(1) !important; }
        ${gmailBody} {
          color-scheme: dark !important;
          background-color: #202124 !important;
          color: #e8eaed !important;
        }
        /* Neutralize sender colors and legacy bgcolor/font attributes without
           changing layout, hidden preheaders, quoted text or image pixels. */
        ${gmailBody} * {
          background-color: transparent !important;
          color: #e8eaed !important;
          border-color: #5f6368 !important;
          text-shadow: none !important;
          -webkit-text-fill-color: currentColor !important;
        }
        ${gmailBody}[style*="gradient" i], ${gmailBody} [style*="gradient" i] {
          background-image: none !important;
        }
        ${gmailBody} a[href], ${gmailBody} a[href] * {
          color: #8ab4f8 !important;
        }
        ${gmailBody} a[href]:hover { text-decoration: underline !important; }
        ${gmailBody} :focus-visible {
          outline: 2px solid #8ab4f8 !important; outline-offset: 2px !important;
        }
        ${gmailBody} ::selection, ${gmailBody}::selection {
          background-color: #8ab4f8 !important; color: #202124 !important;
          -webkit-text-fill-color: currentColor !important;
        }
      `,
    },
  };
  const theme = themes[location.hostname];
  if (!theme) {
    alert(`Dark Mode currently supports ${Object.values(themes).map(({ name }) => name).join(" and ")}. Other sites are unchanged.`);
    return;
  }
  const id = "tools-darkmode-style";
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
    return;
  }
  const style = document.createElement("style");
  style.id = id;
  // Keep the stylesheet in the document head: Gmail replaces message bodies
  // during navigation, but newly inserted bodies match these rules immediately.
  style.textContent = theme.css;
  document.head.append(style);
})();
