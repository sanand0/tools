const css = /* css */ `
/* ===== GLOBAL COLORS ===== */
html, body, .main, .overflow-hidden {
background-color: #212529 !important;
color: #e9ecef !important;
font-family: Optima, Candara, 'Noto Sans', source-sans-pro, sans-serif;
margin: 0 !important;
padding: 0 !important;
}

nav, header, .top-bar, div[class*="Header"], div[class*="Nav"], div[class*="nav"], main, div#app, .content, .main-content, .page-content, .bg-token-bg-elevated-secondary, .bg-token-message-surface, .bg-token-bg-primary {
background-color: #2b3035 !important;
color: #fff !important;
border: none !important;
}

/* ===== NAVBAR ===== */
header, nav, .top-bar, div.grid.w-full.grid-cols-\\[1fr_auto_1fr\\] {
display: flex !important;
align-items: center !important;
justify-content: center !important;
background-color: #2b3035 !important;
color: #fff !important;
height: 64px !important;
border-bottom: 1px solid #343a40 !important;
position: sticky !important;
top: 0 !important;
z-index: 1000 !important;
width: 100% !important;
margin: 0 !important;
padding: 0 !important;
}

a[href="/codex"] {
display: flex !important;
align-items: center !important;
gap: 10px !important;
text-decoration: none !important;
justify-content: center !important;
}
a[href="/codex"] svg { display: none !important; }
a[href="/codex"]::before {
content: "";
display: inline-block;
width: 28px;
height: 28px;
background: url('https://raw.githubusercontent.com/gramener/assets/main/straive-favicon.svg') center/contain no-repeat;
vertical-align: middle;
position: relative;
top: -11px;
}
a[href="/codex"]::after {
content: "Straive Intelligence";
font-size: 1.7rem;
font-weight: 600;
color: rgb(247, 66, 25);
vertical-align: middle;
transform: translateY(-11px);
}
a[href="/codex"]:hover::after { color: rgb(255, 100, 50); }

/* ===== HIDE ELEMENTS ===== */
button[aria-label="Open settings sidebar"], a[href="/docs"], button[aria-label="Open Profile Menu"], [data-testid="profile-button"] { display: none !important; }

/* ===== LAYOUT FIXES ===== */
.bg-token-bg-primary.sticky.top-0.z-50.flex.flex-col.items-center {
background-color: #212529 !important;
border-radius: 12px !important;
margin-top: 0.5rem !important;
padding-top: 0.5rem !important;
}
[data-testid="composer-footer-actions"] { margin-left: 12px !important; }
[grid-area="leading"] { margin-right: 12px !important; }
.flex.items-center.gap-2 > div > button[aria-label*="feedback"] { margin-right: 8px !important; }
.flex.items-center.gap-2 > div > button[aria-label*="feedback"]:last-child { margin-right: 0 !important; }
.border-token-border-light.grid.w-full.grid-cols-\\[minmax\\(0,1fr\\)_auto\\].items-center {
background-color: #212529 !important;
border-color: #3e4449 !important;
}

/* ===== INPUTS ===== */
textarea, input[type="text"], [data-testid="prompt-textarea"] {
background-color: #2b3035 !important;
color: #e9ecef !important;
border: 1px solid #212529 !important;
border-radius: 8px !important;
padding: 0.75rem 1rem !important;
font-size: 1rem !important;
resize: none !important;
}
textarea:focus, input:focus {
outline: none !important;
border-color: rgb(235, 100, 50) !important;
box-shadow: 0 0 0 2px rgba(235, 100, 50, 0.4) !important;
}

/* ===== CONTAINERS ===== */
main, .conversation-container, .chat, .chat-history, .prose, .scroll-container {
background-color: #212529 !important;
color: #e9ecef !important;
padding-bottom: 60px !important;
}
.card, .panel, .message, .box, .group, .container {
background-color: #2c3036 !important;
border-color: #343a40 !important;
color: #e9ecef !important;
border-radius: 8px !important;
}

/* ===== BUTTONS ===== */
button, .btn {
background-color: rgb(235,100,50) !important;
border-color: rgb(235,100,50) !important;
color: #fff !important;
border-radius: 6px !important;
font-size: 0.85rem !important;
padding: 0.4rem 0.75rem !important;
font-weight: 500 !important;
}
button.btn-primary { background-color: #0d6efd !important; border-color: #0d6efd !important; }
button:hover { background-color: rgb(215,80,30) !important; border-color: rgb(215,80,30) !important; }

/* ===== TRANSPARENT ELEMENTS ===== */
div[class*="bg-token-border-default"], div[class*="bg-token-border-light"], div[class*="bg-token-border-primary"], div[class*="bg-token-border-tertiary"], div[class*="bg-token-border-strong"], div[class*="bg-token-border-subtle"], div[role="menu"], div[role="listbox"], div[role="presentation"], div[role="group"], div[class*="flex"].cursor-pointer, button.flex.cursor-pointer.items-center.rounded-\\[10px\\], div.flex.cursor-pointer.items-center.rounded-\\[10px\\], [data-testid="composer-footer-actions"] button, [data-testid="composer-footer-actions"] .composer-btn {
background-color: transparent !important;
border: none !important;
box-shadow: none !important;
}

div[class*="bg-token-border-default"].h-px, div[class*="bg-token-border-light"].h-px {
background-color: transparent !important;
height: 0 !important;
border: none !important;
}

button.flex.cursor-pointer.items-center.rounded-\\[10px\\]:hover, div.flex.cursor-pointer.items-center.rounded-\\[10px\\]:hover {
background-color: rgba(255, 255, 255, 0.03) !important;
}

button.flex.cursor-pointer.items-center.rounded-\\[10px\\] span, div.flex.cursor-pointer.items-center.rounded-\\[10px\\] span, div.flex.flex-col.items-start.py-1, div.flex.items-center.text-start.text-sm, [data-testid="composer-footer-actions"] button span, [data-testid="composer-footer-actions"] .composer-btn span, [data-testid="composer-footer-actions"] button div, [data-testid="composer-footer-actions"] .composer-btn div {
color: #e9ecef !important;
background-color: transparent !important;
}

[data-testid="composer-footer-actions"] button:hover, [data-testid="composer-footer-actions"] .composer-btn:hover, [data-testid="composer-footer-actions"] button[aria-expanded="true"], [data-testid="composer-footer-actions"] .composer-btn[aria-expanded="true"] {
background-color: transparent !important;
box-shadow: none !important;
border: none !important;
color: rgb(255, 120, 60) !important;
}

[data-testid="composer-footer-actions"] svg {
background-color: transparent !important;
color: #e9ecef !important;
opacity: 0.95 !important;
}

/* ===== MESSAGE CONTENT BOX ===== */
div.px-4.text-sm.break-words.whitespace-pre-wrap {
background-color: #2f343a !important;
border: 1px solid rgb(235, 100, 50) !important;
border-radius: 8px !important;
padding: 1rem !important;
margin: 0.75rem 0 !important;
color: #f8f9fa !important;
box-shadow: 0 0 8px rgba(235, 100, 50, 0.2) !important;
transition: all 0.2s ease-in-out !important;
}
div.px-4.text-sm.break-words.whitespace-pre-wrap:hover {
background-color: #353b41 !important;
border-color: rgb(255, 120, 70) !important;
box-shadow: 0 0 12px rgba(255, 120, 70, 0.3) !important;
}

/* ===== FILE DROPDOWN ===== */
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border {
background-color: transparent !important;
border: 1px solid rgb(235, 100, 50) !important;
box-shadow: none !important;
}
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border > button {
background-color: transparent !important;
border: none !important;
color: #e9ecef !important;
}
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border > button:hover { background-color: transparent !important; color: rgb(255, 120, 60) !important; }
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border ul, div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li, div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li button {
background-color: transparent !important;
border: none !important;
box-shadow: none !important;
color: #e9ecef !important;
}
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li button:hover { background-color: rgba(255, 255, 255, 0.03) !important; border-radius: 8px !important; }
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li button::after { background-color: transparent !important; }
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li span.text-green-500 { color: #5ccf80 !important; }
div.bg-token-bg-primary.flex.flex-col.rounded-2xl.border li span.text-red-500 { color: #ff6b6b !important; }

/* ===== CREATE PR BUTTON ===== */
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary {
background-color: rgb(247, 66, 25) !important;
border: 1px solid rgb(247, 66, 25) !important;
color: #fff !important;
border-radius: 9999px !important;
overflow: hidden !important;
transition: all 0.2s ease-in-out !important;
box-shadow: 0 2px 6px rgba(247, 66, 25, 0.25) !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary:hover {
background-color: rgb(255, 100, 50) !important;
border-color: rgb(255, 100, 50) !important;
box-shadow: 0 3px 10px rgba(255, 100, 50, 0.35) !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary:active {
transform: scale(0.98) !important;
box-shadow: 0 1px 4px rgba(247, 66, 25, 0.2) !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary > div > button:first-child {
background-color: transparent !important;
color: #fff !important;
padding: 0.5rem 1rem !important;
border: none !important;
transition: all 0.2s ease-in-out !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary > div > button:first-child:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary .bg-token-text-inverted\\/20 {
background-color: rgba(255, 255, 255, 0.25) !important;
height: 24px !important;
margin: 0 4px !important;
width: 1px !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary > div > button:last-child {
background-color: transparent !important;
color: #fff !important;
border: none !important;
padding: 0.5rem 0.9rem !important;
opacity: 0.85 !important;
transition: all 0.2s ease-in-out !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary > div > button:last-child:hover {
opacity: 1 !important;
background-color: rgba(255, 255, 255, 0.1) !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary svg {
color: #fff !important;
opacity: 0.9 !important;
transition: opacity 0.2s ease-in-out !important;
}
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary:hover svg { opacity: 1 !important; }

@media (max-width: 768px) {
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary { padding: 0.4rem 0.8rem !important; border-radius: 8px !important; }
.inline-flex.w-fit.items-center.rounded-full.text-sm.font-medium.btn-primary span.truncate { font-size: 0.9rem !important; }
}

/* ===== IMAGE BUTTON ===== */
p[data-start][data-end] > button.max-h-\\[250px\\].max-w-\\[250px\\] {
border: none !important;
outline: none !important;
background: transparent !important;
box-shadow: none !important;
padding: 0 !important;
margin: 0 !important;
}
p[data-start][data-end] > button.max-h-\\[250px\\].max-w-\\[250px\\] img {
border: none !important;
outline: none !important;
box-shadow: none !important;
background: transparent !important;
border-radius: 6px !important;
}
p[data-start][data-end] > button.max-h-\\[250px\\].max-w-\\[250px\\] + p[data-start][data-end] { margin-top: 2rem !important; }

/* ===== PILL BUTTON ===== */
button.inline-flex.w-fit.cursor-pointer.items-center.rounded-full.px-2\\.5.py-1.text-\\[10px\\].font-semibold {
background-color: rgba(247, 66, 25, 0.15) !important;
border: 1px solid rgb(247, 66, 25) !important;
color: rgb(247, 66, 25) !important;
border-radius: 9999px !important;
font-size: 0.7rem !important;
font-weight: 600 !important;
line-height: 1 !important;
padding: 0.35rem 0.75rem !important;
display: inline-flex !important;
align-items: center !important;
justify-content: center !important;
gap: 0.25rem !important;
text-transform: uppercase !important;
transition: all 0.25s ease-in-out !important;
box-shadow: 0 0 4px rgba(247, 66, 25, 0.2) !important;
}
button.inline-flex.w-fit.cursor-pointer.items-center.rounded-full.px-2\\.5.py-1.text-\\[10px\\].font-semibold:hover {
background-color: rgb(247, 66, 25) !important;
color: #fff !important;
box-shadow: 0 0 10px rgba(247, 66, 25, 0.4) !important;
transform: translateY(-1px);
}
button.inline-flex.w-fit.cursor-pointer.items-center.rounded-full.px-2\\.5.py-1.text-\\[10px\\].font-semibold svg {
width: 14px !important;
height: 14px !important;
color: inherit !important;
margin-right: 4px !important;
vertical-align: middle !important;
transition: transform 0.25s ease-in-out, opacity 0.25s ease-in-out;
}
button.inline-flex.w-fit.cursor-pointer.items-center.rounded-full.px-2\\.5.py-1.text-\\[10px\\].font-semibold:hover svg { transform: scale(1.1); opacity: 0.9; }
._label_m72g5_22, [aria-label="Open diff settings menu"] {
width: 44px !important;
height: 44px !important;
}

[aria-label="Open diff settings menu"] {
height: 42px !important;
}
`;

export function redesign() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
