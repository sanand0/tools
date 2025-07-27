# PicBook

PicBook turns a list of short captions into a sequence of images while keeping the style consistent. You can provide a reference image or URL as inspiration, add some context about the story and desired style, and then generate one panel per line.

## What it does

1. **Context and Captions**
   - Enter an overall description of the picture book's style.
   - Provide one caption per line; each becomes an image.
2. **Reference Image**
   - Optionally upload or link to an image so the first panel matches its style.
   - Subsequent panels use the previous image as an additional reference.
3. **Progress Tracking**
   - A progress bar shows how many panels are done and estimates total time.
   - You can pause after any panel and continue later.
4. **Download**
   - Each panel has a download button, and you can download all as a ZIP archive.

## How it works

1. Configure your OpenAI API key and base URL.
2. The first caption is sent to `/images/edits` if a reference is provided, otherwise to `/images/generations`.
3. Each subsequent caption is sent along with the previous panel as the reference image to maintain consistency.
4. Images are displayed as they arrive and can be individually downloaded or saved as a ZIP file.
