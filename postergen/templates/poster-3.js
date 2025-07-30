/**
 * Poster-3 template that can adapt to different dimensions
 * @param {number} width - Width of the poster in pixels
 * @param {number} height - Height of the poster in pixels
 * @returns {string} HTML template with the specified dimensions
 */
const poster3Template = (width, height) => {
  // Calculate proportional sizes based on dimensions
  // Using the original poster-3 template as the base reference
  const baseWidth = 750;
  const baseHeight = 1000;

  // Scale factor for width and height
  const widthScale = width / baseWidth;
  const heightScale = height / baseHeight;

  // Calculate scaled dimensions for elements used multiple times
  const logoWidth = 100 * widthScale;
  const logoHeight = 100 * heightScale;

  return /* html */ `<div style="width: ${width}px; height: ${height}px; position: relative; margin: 0 auto; overflow: hidden;">
  <img
    data-name="background"
    data-prompt="A large background image for the poster"
    width="${width}"
    height="${height}"
    style="position: absolute; top: 0; left: 0;"
    src="https://placehold.co/${width}x${height}/f5f5f5/cccccc" />

  <div style="position: absolute; top: 0; right: 0; width: ${
    375 * widthScale
  }px; height: ${height}px; background-color: rgba(0, 0, 0, 0.25);"></div>

  <div
    data-name="top_headline"
    data-prompt="Top headline text (3-5 words)"
    contentEditable="true"
    style="
      position: absolute;
      left: ${75 * widthScale}px;
      top: ${85 * heightScale}px;
      width: ${250 * widthScale}px;
      font-size: ${36 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      font-weight: bold;
      color: #fff;
      text-transform: uppercase;
      line-height: 1.1;
    ">Top Headline</div>

  <div
    data-name="bottom_headline"
    data-prompt="Bottom headline text (3-5 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${75 * widthScale}px;
      top: ${570 * heightScale}px;
      width: ${250 * widthScale}px;
      font-size: ${36 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      font-weight: bold;
      color: #fff;
      text-transform: uppercase;
      line-height: 1.1;
    ">Bottom Headline</div>

  <div
    data-name="body_text"
    data-prompt="Body text paragraph (30-50 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${75 * widthScale}px;
      top: ${670 * heightScale}px;
      width: ${250 * widthScale}px;
      font-size: ${14 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      color: #ddd;
      line-height: 1.4;
    ">Detailed body text comes here.</div>

  <div
    data-name="call_to_action"
    data-prompt="Call to action text (10-15 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${75 * widthScale}px;
      bottom: ${100 * heightScale}px;
      background-color: #dc3545;
      color: white;
      padding: 12px 32px;
      border-radius: 25px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto;
      font-size: ${16 * Math.min(widthScale, heightScale)}px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    "
  >
    <span>Learn More</span>
  </div>

  <div
    data-name="card_tagline"
    data-prompt="Card tagline (3-5 words)"
    contentEditable="true"
    style="
      position: absolute;
      right: ${75 * widthScale}px;
      top: ${800 * heightScale}px;
      width: ${250 * widthScale}px;
      font-size: ${16 * Math.min(widthScale, heightScale)}px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial, sans-serif;
      font-weight: bold;
      color: #fff;
      text-transform: uppercase;
    ">Card Tagline</div>

  <img
    data-type="logo"
    width="${logoWidth}"
    height="${logoHeight}"
    src="https://placehold.co/${logoWidth}x${logoHeight}/f8d7da/dc3545"
    style="position: absolute; left: ${75 * widthScale}px; bottom: ${100 * heightScale}px; object-fit: contain;"
  />
</div>`;
};

export default poster3Template;
