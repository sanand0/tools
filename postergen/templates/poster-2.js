/**
 * Poster-2 template that can adapt to different dimensions
 * @param {number} width - Width of the poster in pixels
 * @param {number} height - Height of the poster in pixels
 * @returns {string} HTML template with the specified dimensions
 */
const poster2Template = (width, height) => {
  // Calculate proportional sizes based on dimensions
  // Using the original poster-2 template as the base reference
  const baseWidth = 1200;
  const baseHeight = 675;

  // Scale factor for width and height
  const widthScale = width / baseWidth;
  const heightScale = height / baseHeight;

  // Calculate scaled dimensions for elements used multiple times
  const logoWidth = 100 * widthScale;
  const logoHeight = 100 * heightScale;

  return `<div style="width: ${width}px; height: ${height}px; position: relative; margin: 0 auto; overflow: hidden; background-color: #87CEEB;">
  <img
    data-name="background"
    data-prompt="A large background image for the poster"
    width="${width}"
    height="${height}"
    style="position: absolute; top: 0; left: 0;"
    src="https://placehold.co/${width}x${height}/87CEEB/FFFFFF" />

  <img
    data-name="product_container"
    data-prompt="A product image"
    width="${150 * widthScale}"
    height="${200 * heightScale}"
    style="position: absolute; bottom: ${50 * heightScale}px; right: ${
      50 * widthScale
    }px; box-shadow: 2px 2px 10px 4px rgba(255, 255, 255, .2)"
    src="https://placehold.co/${150 * widthScale}x${200 * heightScale}/FFFFFF/CCCCCC" />

  <div style="position: absolute; background-color: rgba(0, 0, 0, 0.3); top: ${
    100 * heightScale
  }px; width: 100%; height: ${130 * heightScale}px;"></div>
  <div
    data-name="headline"
    data-prompt="Main headline (2-5 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${180 * widthScale}px;
      top: ${100 * heightScale}px;
      width: ${1000 * widthScale}px;
      font-size: ${54 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      font-weight: bold;
      color: #ffffff;
      text-align: right;
    ">Main headline</div>

  <div
    data-name="subheadline"
    data-prompt="Supporting tagline (4-7 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${180 * widthScale}px;
      top: ${170 * heightScale}px;
      width: ${1000 * widthScale}px;
      font-size: ${40 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      font-weight: normal;
      color: #ffffff;
      font-variant: small-caps;
      text-align: right;
    ">Sub-heading</div>

  <div style="position: absolute; background-color: rgba(255, 255, 255, 0.4); right: ${
    40 * widthScale
  }px; top: 0; width: ${120 * widthScale}px; height: ${180 * heightScale}px;"></div>
  <img
    data-type="logo"
    width="${logoWidth}"
    height="${logoHeight}"
    src="https://placehold.co/${logoWidth}x${logoHeight}/f8d7da/dc3545"
    style="position: absolute; right: ${50 * widthScale}px; top: ${70 * heightScale}px; object-fit: contain;"
  />
</div>`;
};

export default poster2Template;
