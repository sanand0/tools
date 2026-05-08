# Slide Editor Tool

A beautiful, interactive slide editor for creating professional title slides.

## Features

- **Markdown Support**: Title and subtitle support full Markdown formatting
- **Live Editing**: Changes reflect instantly in both the slide and URL
- **Bookmarkable**: Share or save slides via URL - all settings are preserved
- **Custom Styling**:
  - 12 professional fonts (Montserrat, Roboto, Open Sans, Lato, Raleway, Poppins, Playfair Display, Merriweather, Oswald, Source Sans Pro, Nunito, Inter)
  - Foreground and background color pickers
  - Independent log-scale title and subtitle sizing (+1 = 110%, +2 = 121%, etc., range: -20 to +20)
- **Background Images**: Use any image URL from sources like Unsplash, Pexels, or other providers
- **Responsive Design**: Automatically centers content horizontally and vertically

## Usage

1. Open `index.html` in a web browser
2. Click the edit icon in the top-right corner (visible on hover)
3. Customize your slide:
   - Edit title and subtitle with Markdown
   - Choose a font from the dropdown
   - Adjust title and subtitle sizes independently with the sliders
   - Pick foreground and background colors
   - Optionally paste a background image URL
4. All changes are automatically saved to the URL
5. Copy and share the URL to preserve your exact slide configuration

## Example URLs

Default slide:

```
/slide/#
```

Custom slide:

```
/slide/#?title=%23%20My%20Presentation&subtitle=A%20professional%20slide&font=Poppins&titleScale=2&subtitleScale=0&fgColor=%23ffffff&bgColor=%231a1a2e&bgSearch=https://images.unsplash.com/photo-1506905925346-21bda4d32df4
```

## Rendering

To embed the slide as HTML, use this template, replacing the `$` variables:

```html
<div style="all: initial; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; width: 100vw; height: 100vh; background-size: cover; background-position: center; background-repeat: no-repeat; background-image: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('$bgSearch'); background-color: $bgColor; font-family: '$font', sans-serif; box-sizing: border-box;">
  <div style="position: relative; z-index: 1; text-align: center; padding: 2rem; max-width: 90%; box-sizing: border-box;">
    <h1 style="margin: 0 0 1.5rem 0; font-weight: 700; line-height: 1.2; font-size: $titleSize; color: $fgColor;">$markdown(title)</h1>
    <h2 style="margin: 0; font-weight: 400; line-height: 1.4; font-size: $subtitleSize; color: $fgColor;">$markdown(subtitle)</h2>
  </div>
</div>
```

## Tips

- Use Markdown in title/subtitle for **bold**, _italic_, or other formatting
- Leave background URL empty for a solid color background
- Get free images from [Unsplash](https://unsplash.com), [Pexels](https://www.pexels.com), or [Pixabay](https://pixabay.com)
- Right-click on an image and select "Copy image address" to get the URL
- Title and subtitle scales are logarithmic: each +1 increases size by 10%
- Colors can be entered as hex codes in the text field or selected with the color picker
