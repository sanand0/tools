// @ts-check
(() => {
  // Exact hosts keep future site themes isolated; no requests run on the target site.
  const themes = {
    "news.ycombinator.com": `
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
  };
  const css = themes[location.hostname];
  if (!css) {
    alert("Dark Mode currently supports Hacker News (news.ycombinator.com). Other sites are unchanged.");
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
  style.textContent = css;
  document.head.append(style);
})();
