// Match the light/dark system preference used by the other standalone tools.
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  document.documentElement.setAttribute('data-bs-theme', media.matches ? 'dark' : 'light');
}
applyTheme();
media.addEventListener?.('change',applyTheme);
