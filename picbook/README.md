# PicBook

PicBook turns a list of short captions into a sequence of images while keeping the style consistent. You can provide a reference image or URL as inspiration, add some context about the story and desired style, and then generate one panel per line.

## What it does

1. **Context and Panels**
   - Enter common guidance for the whole book.
   - Each line is `Caption text [Prompt for LLM]`.
2. **Reference Image**
   - Optionally upload or link to an image so the first panel matches its style.
   - Later panels use both the original reference and the previous image.
3. **Progress Tracking**
   - A progress bar shows how many panels are done and estimates total time.
   - You can pause after any panel and continue later.
4. **Download**
   - Download all generated panels as a ZIP archive.

## How it works

1. Configure your OpenAI API key and base URL.
2. The first panel uses the uploaded image (or URL) if provided.
3. Later panels also send the previous image for style consistency.
4. Images appear as soon as they are ready and can be saved individually or as a ZIP.
