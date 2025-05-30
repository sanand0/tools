# LLM-Powered Object Detection and Bounding Box Tool

This tool uploads an image and uses various Large Language Models (LLMs) via the LLM Foundry service to perform object detection. It then displays the original image with bounding boxes and labels overlaid for each model used, and provides a table of detected objects, their colors, and coordinates.

## What it does

The tool enables users to upload an image and have it analyzed by a range of different LLMs (including models from Gemini, OpenAI GPT, Anthropic Claude, Llama, Qwen, and Mistral families). For each model:
-   The image is sent to the LLM with a prompt requesting object detection.
-   The LLM is expected to return a JSON object containing labels for detected objects, their prominent color, and their bounding box coordinates (x1, y1, x2, y2 in pixels).
-   The tool then draws the uploaded image on a separate canvas for each model.
-   On each canvas, it overlays the bounding boxes and labels as returned by the respective LLM. The model's name is also watermarked.
-   A corresponding table lists the detected objects, their colors, and their pixel coordinates.
-   Finally, users can download a ZIP file containing all the annotated images (one WebP image per model).

**Note:** This tool requires the user to be authenticated with `llmfoundry.straive.com` as it makes API calls to this service to interact with the LLMs.

## Use Cases

-   **Comparative LLM Analysis:** Visually compare the object detection capabilities (accuracy, detail, common errors) of different LLMs on the same image.
-   **AI-Assisted Data Labeling (Prototyping):** Quickly generate initial bounding boxes for objects in images, which could then be refined by human annotators.
-   **Computer Vision Prototyping:** Experiment with how various vision-capable LLMs interpret and segment objects within images.
-   **Educational Tool:** Demonstrate the application of multimodal LLMs in computer vision tasks.

## How It Works

1.  **Authentication:** The user must be logged into `llmfoundry.straive.com` in their browser session.
2.  **Image Upload:**
    *   The user selects an image file using the "Upload Image for Object Detection" input.
3.  **Processing:**
    *   Once an image is selected, the tool uploads it.
    *   The image is converted to base64 format.
    *   For each pre-configured LLM:
        *   An API request is made to the LLM Foundry service, sending the image data and a prompt asking for object detection results in a specific JSON format: `{[label]: [color, x1, y1, x2, y2], ...}`.
        *   A new canvas is created for the model. The uploaded image is drawn onto it.
        *   The LLM's JSON response is parsed.
        *   Bounding boxes and labels are drawn on the model's canvas based on the coordinates and labels received. The model's name is also written on the canvas.
        *   A table below the canvas is populated with the labels, colors, and coordinates of the detected objects.
4.  **View Results:** The user can see a section for each model, containing the annotated image and the corresponding table of detections.
5.  **Download Results:**
    *   The user can click the "Download All Results" button.
    *   This generates a ZIP file containing all the annotated canvas images, with each image named after the model that produced it (e.g., `gemini-1.5-flash-001.webp`).

The tool uses `asyncllm` library for interacting with the LLM APIs and `JSZip` for creating the downloadable archive. Errors during API calls or processing are logged to the console and may result in an alert.
