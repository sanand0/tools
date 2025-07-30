/**
 * Poster-1 template that can adapt to different dimensions
 * @param {number} width - Width of the poster in pixels
 * @param {number} height - Height of the poster in pixels
 * @returns {string} HTML template with the specified dimensions
 */
const poster1Template = (width, height) => {
  // Calculate proportional sizes based on dimensions
  // Using the 1000x1000 template as the base reference
  const baseWidth = 1000;
  const baseHeight = 1000;

  // Scale factor for width and height
  const widthScale = width / baseWidth;
  const heightScale = height / baseHeight;

  // Calculate scaled dimensions for elements used multiple times
  const logoWidth = 267 * widthScale;
  const logoHeight = 133 * heightScale;
  const logoTop = 800 * heightScale;

  // Adjust logo position for very short posters
  const adjustedLogoTop = Math.min(logoTop, height - logoHeight - 20);

  return `<div style="width: ${width}px; height: ${height}px; position: relative; margin: 0 auto">
  <img
    data-name="background"
    data-prompt="A large background image for the poster"
    width="${width}"
    height="${height}"
    style="position: absolute"
    src="https://placehold.co/${width}x${height}/f8d7da/dc3545"
  />

  <!-- Semi-transparent chevron background -->
  <div
    style="
      position: absolute;
      left: 0px;
      top: ${230 * heightScale}px;
      width: ${867 * widthScale}px;
      height: ${180 * heightScale}px;
      background-color: rgba(0, 0, 0, 0.4);
      clip-path: polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%);
      z-index: 1;
    "
  ></div>

  <div
    data-name="title"
    data-prompt="Large title of the poster (2-5 words)"
    contentEditable="true"
    style="
      position: absolute;
      left: ${100 * widthScale}px;
      top: ${250 * heightScale}px;
      width: ${800 * widthScale}px;
      font-size: ${64 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Liberation Sans, Arial,
        sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
      font-weight: bold;
      color: #ffffff;
      z-index: 2;
    "
  >
    Title
  </div>
  <div
    data-name="subtitle"
    data-prompt="Subtitle of the poster (4-8 words)"
    contentEditable="true"
    style="
      position: absolute;
      left: ${100 * widthScale}px;
      top: ${350 * heightScale}px;
      width: ${800 * widthScale}px;
      font-size: ${32 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Liberation Sans, Arial,
        sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
      font-weight: bold;
      color: #ffffff;
      z-index: 2;
    "
  >
    Subtitle
  </div>
  <img
    data-type="logo"
    width="${logoWidth}"
    height="${logoHeight}"
    src="https://placehold.co/${logoWidth}x${logoHeight}/white/black"
    style="position: absolute; right: ${67 * widthScale}px; top: ${adjustedLogoTop}px; object-fit: contain"
  />
</div>`;
};

export default poster1Template;
