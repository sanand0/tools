# Slide Editor Tool

A beautiful, interactive slide editor for creating professional title slides.

## Features

- **Markdown Support**: Title and subtitle support full Markdown formatting
- **Live Editing**: Changes reflect instantly in both the slide and URL
- **Bookmarkable**: Share or save slides via URL - all settings are preserved
- **Custom Styling**:
  - 12 professional fonts (Montserrat, Roboto, Open Sans, Lato, Raleway, Poppins, Playfair Display, Merriweather, Oswald, Source Sans Pro, Nunito, Inter)
  - Foreground and background color pickers
  - Log-scale font sizing (+1 = 110%, +2 = 121%, etc., range: -20 to +20)
- **Background Images**: Search for images using keywords (powered by Unsplash)
- **Responsive Design**: Automatically centers content horizontally and vertically

## Usage

1. Open `index.html` in a web browser
2. Click the edit icon in the top-right corner (visible on hover)
3. Customize your slide:
   - Edit title and subtitle with Markdown
   - Choose a font from the dropdown
   - Adjust font scale using the slider
   - Pick foreground and background colors
   - Optionally search for a background image
4. All changes are automatically saved to the URL
5. Copy and share the URL to preserve your exact slide configuration

## Example URLs

Default slide:
```
/slide/#
```

Custom slide:
```
/slide/#?title=%23%20My%20Presentation&subtitle=A%20professional%20slide&font=Poppins&scale=2&fgColor=%23ffffff&bgColor=%231a1a2e&bgSearch=nature
```

## Tips

- Use Markdown in title/subtitle for **bold**, *italic*, or other formatting
- Leave background search empty for a solid color background
- The font scale uses a logarithmic scale: each +1 increases size by 10%
- Colors can be entered as hex codes in the text field or selected with the color picker
