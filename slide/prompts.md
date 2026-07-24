# slide

<!--
cd ~/code/tools/
dev.sh -- claude --dangerously-skip-permissions --model opus --effort medium
-->

Modify slide/ so that the "Edit Slide" model fits comfortably on the screen without vertical scrolling.

- Title Size and Subtitle Size selectors have the label, scale factor display, and the input range in one line
- Foreground and background color pickers are on one line.
- Fonts for the title and subtitle can be picked independently and the selectors are on one line
- Reduce the height of the Title textarea to 1 line

Also, add pre-defined themes that I can pick from in a dropdown alongside the "Edit Slide" header, towards the right. These should include good choices of fonts, sizes, colors, and background images. Make sure these are visually distinct, attractive, and professional. Copying popular styles (e.g. Steve Jobs' presentations) is probably a good idea.

Test on CDP localhost:8222 visually and confirm they're beautiful.

<!-- claude --resume 5358a4ef-bdac-465a-89ab-89cb37c9c52c --dangersoly-skip-permissions -->
<!-- I renamed Bold Poster to Flame and used https://images.pexels.com/photos/7605676/pexels-photo-7605676.jpeg as the background -->
