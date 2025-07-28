const css = /* css */ `
/* Navbar and layout colors */
nav,
header,
.sidebar,
.top-bar,
div[class*="sidebar"],
div[class*="Header"],
div[class*="Nav"],
div[class*="nav"],
main,
div#app,
.content,
.main-content,
.page-content,
.bg-token-bg-elevated-secondary,
.bg-token-message-surface,
.bg-token-bg-primary {
  background-color: #2b3035 !important;
  color: #fff !important;
}
body,
.main,
.overflow-hidden {
  background-color: #212529 !important;
  color: #e9ecef !important;
  /* font-family: Georgia, "Times New Roman", Times, serif !important; */
  font-family: Optima, Candara, 'Noto Sans', source-sans-pro, sans-serif;
}

/* Hide sidebar container */
#stage-slideover-sidebar {
  display: none;
}

/* Adjust any arrow indicators or directional elements */
[data-rtl-flip] {
  transform: scaleX(-1) !important;
}

/* Adjust the overall page layout */
.page-container,
.app-container {
  flex-direction: row-reverse !important;
}

/* Navbar links */
nav a.navbar-brand,
nav .navbar-nav a.nav-link,
nav .navbar-toggler-icon {
  color: #fff !important;
}
nav a.navbar-brand,
nav .navbar-nav a.nav-link {
  color: #adb5bd !important;
}
nav button.navbar-toggler {
  border-color: #495057 !important;
}
nav button.navbar-toggler-icon {
  filter: brightness(80%);
}

/* Links */
a,
a:visited {
  color: #74a9ff !important;
}
a:focus {
  color: #a2c7ff !important;
  text-decoration: underline;
}

/* Cards and containers */
.card,
.panel,
.container,
.box,
.group {
  background-color: #2c3036 !important;
  border-color: #343a40 !important;
  color: #e9ecef !important;
}

/* Form elements */
input,
textarea,
select,
button {
  background-color: #2c3036 !important;
  color: #e9ecef !important;
  border: 1px solid #495057 !important;
}
input::placeholder,
textarea::placeholder {
  color: #adb5bd !important;
}

/* Buttons */
button,
.btn {
  background-color: rgb(235, 100, 50) !important;
  border-color: rgb(235, 100, 50) !important;
  color: #fff !important;
  padding: 0.2rem !important;
  margin: 0.2rem !important;
  border-radius: 0.25rem !important;
  font-size: 0.75rem !important;
}
button.btn-primary {
  background-color: #0d6efd !important;
  border-color: #0d6efd !important;
  color: #fff !important;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-track {
  background: #212529;
}
::-webkit-scrollbar-thumb {
  background-color: #495057;
  border-radius: 10px;
  border: 2px solid #212529;
}

/* Model switcher with custom label + logo - MOVED TO LEFT */
[data-testid="model-switcher-dropdown-button"] {
  position: absolute !important;
  left: 50% !important; /* Changed from 50% to 35% to move left */
  transform: translateX(-50%) !important;
  z-index: 10;
  padding: 0.4rem 0.75rem !important;
  height: auto !important;
  width: auto !important;
  min-height: unset !important;
  min-width: unset !important;
  background: none !important;
  border: none !important;
  cursor: pointer !important;
  pointer-events: auto !important;
  box-shadow: none !important;
  margin-left: 0 !important; /* Removed the 120px margin */
}
[data-testid="model-switcher-dropdown-button"] > div:first-child {
  color: transparent !important;
  font-size: 0 !important;
  position: relative;
}
[data-testid="model-switcher-dropdown-button"] > div:first-child::before {
  content: "Straive Intelligence";
  font-size: 1.5rem;
  font-weight: 500;
  color: rgb(247, 66, 25);
  display: inline-block;
  background: url("https://raw.githubusercontent.com/gramener/assets/main/straive-favicon.svg") left center/1.5rem
    1.5rem no-repeat;
  padding-left: 1.8rem;
}
[data-testid="model-switcher-dropdown-button"] svg {
  display: inline-block !important;
  margin-left: 0rem;
  fill: #f74219;
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
}

/* Hide temporary chat and Get Plus buttons */
button[aria-label="Turn on temporary chat"],
button.flex.items-center.rounded-full.bg-[#F1F1FB],
button.dark:bg-[#373669] {
  display: none !important;
}

/* Replace inline button icon with Straive logo - Updated with better positioning */
button svg.icon-lg.-m-1 {
  display: none !important;
}

/* Give the button container more space */
button:has(svg.icon-lg.-m-1) {
  padding-left: 0 !important;
  margin-left: -10px !important;
  position: relative !important;
}

button:has(svg.icon-lg.-m-1)::before {
  content: "";
  display: inline-block;
  width: 30px;
  height: 30px;
  margin-right: 15px;
  margin-left: -35px; /* Shift significantly to the left */
  background: url("https://raw.githubusercontent.com/gramener/assets/main/straive-favicon.svg") center/contain no-repeat;
  vertical-align: middle;
  transform: scaleX(-1); /* Flip the logo horizontally */
  position: relative;
  z-index: 10;
}

/* Remove content fade effect */
.content-fade::after {
  background: transparent !important;
  z-index: -1 !important;
}

/* Hide ChatGPT footer disclaimer */
div.text-token-text-secondary.flex.items-center.justify-center.text-xs {
  display: none !important;
}

/* Move Share and Options buttons to the start of navbar */
#conversation-header-actions {
  position: absolute !important;
  left: 20px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 100 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* Ensure the parent container allows absolute positioning */
.flex.items-center:has(#conversation-header-actions) {
  position: relative !important;
  justify-content: flex-start !important;
}

/* Style the Share button with orange background */
button[data-testid="share-chat-button"] {
  background-color: rgb(235, 100, 50) !important;
  border: 1px solid rgb(235, 100, 50) !important;
  color: #fff !important;
  padding: 0.5rem 1rem !important;
  border-radius: 0.375rem !important;
  font-size: 0.875rem !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
}

button[data-testid="share-chat-button"]:hover {
  background-color: rgb(215, 80, 30) !important; /* Darker orange on hover */
  border-color: rgb(215, 80, 30) !important;
}

/* Style the Options button with orange background */
button[data-testid="conversation-options-button"] {
  background-color: rgb(235, 100, 50) !important;
  border: 1px solid rgb(235, 100, 50) !important;
  color: #fff !important;
  padding: 0.5rem !important;
  border-radius: 0.375rem !important;
}

button[data-testid="conversation-options-button"]:hover {
  background-color: rgb(215, 80, 30) !important; /* Darker orange on hover */
  border-color: rgb(215, 80, 30) !important;
}

/* Responsive behavior for mobile */
@media (max-width: 768px) {
  #conversation-header-actions {
    position: static !important;
    transform: none !important;
    order: -1 !important;
    margin-right: auto !important;
  }

  [data-testid="model-switcher-dropdown-button"] {
    margin-left: 0 !important;
    position: relative !important;
    left: auto !important;
    transform: none !important;
  }

  button[data-testid="share-chat-button"] {
    padding: 0.375rem 0.75rem !important;
    font-size: 0.75rem !important;
  }
}

/* Increase navbar height */
nav, header, .navbar {
  height: 55px !important;
  min-height: 55px !important;
  padding: 1rem 0 !important;
}

.navbar-brand {
  font-size: 1.5rem !important;
  line-height: 1.5 !important;
}

.navbar-nav {
  padding: 0.5rem 0 !important;
}
`;

export function redesign() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
