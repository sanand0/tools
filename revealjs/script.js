import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
const marked = new Marked();

const textarea = document.getElementById("markdown-input");
const generateBtn = document.getElementById("generate-btn");

// Load saved content
textarea.value = localStorage.getItem("revealjs-markdown-content") || "";

// Save content on change
textarea.addEventListener("input", () => {
  localStorage.setItem("revealjs-markdown-content", textarea.value);
});

function createPresentationHTML(markdown) {
  const slides = markdown.split(/(?=^#{1,2} )/m);
  const slideHTML = slides.map((slide) => `<section>${marked.parse(slide.trim())}</section>`).join("\n");

  return `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reset.css">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css">
        </head>
        <body>
          <div class="reveal">
            <div class="slides">
              ${slideHTML}
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"><\/script>
          <script>
            Reveal.initialize({
              width: 1280,     // Base slide width
              height: 700,     // Base slide height
              margin: 0.1,     // 10% margin around content
              minScale: 0.2,   // Don’t scale below 20% of the original size
              maxScale: 1.0,   // Never scale above the original size
              hash: true,
              transition: 'slide'
            });
          <\/script>
        </body>
        </html>
      `;
}

generateBtn.addEventListener("click", () => {
  try {
    const markdown = textarea.value.trim();
    if (!markdown) {
      throw new Error("Please enter some Markdown content");
    }

    const presentationHTML = createPresentationHTML(markdown);
    const presentationWindow = window.open();
    presentationWindow.document.write(presentationHTML);
    presentationWindow.document.close();
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});
