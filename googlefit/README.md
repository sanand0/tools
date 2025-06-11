# Google Fit Activity Viewer

This tool allows you to view and summarize your Google Fit activity data obtained from Google Takeout.

## What it does

The tool processes `.tcx` files exported from Google Fit (via Google Takeout) and presents a consolidated view of your activities. It groups activities by date and sport, displaying key metrics like distance, duration, and calories burned for each recorded session.

## Use Cases

- **Activity Overview:** Get a quick overview of your workouts and physical activities over time.
- **Data Analysis:** Easily see how much you've engaged in specific sports or activities on different days.
- **Offline Access:** View your Google Fit data locally without needing to connect to Google Fit services, once you have the Takeout files.
- **Data Backup Visualization:** Useful for inspecting the contents of your Google Fit data backup from Takeout.

## How It Works

1.  **Export Your Data:**

    - Go to [Google Takeout](https://takeout.google.com/).
    - Deselect all products, then select only "Fit".
    - Choose your delivery method, frequency, and file type (usually `.zip`).
    - Complete the export process and download the zip file.

2.  **Locate Activity Files:**

    - Unzip the downloaded file from Google Takeout.
    - Navigate to the `Takeout/Fit/Activities/` directory. This folder contains your activity data in `.tcx` format.

3.  **Upload to the Tool:**

    - Open the `index.html` file of this tool in your web browser.
    - Click the file input field.
    - Select one or more `.tcx` files from the `Activities` folder.

4.  **View Summary:**
    - The tool will automatically parse the uploaded files.
    - It displays a table where:
      - Each row represents a date.
      - Columns represent different types of sports/activities found in your files (e.g., Running, Cycling, Walking).
      - Cells show the distance (km), duration (minutes/seconds), and calories burned for each activity on a given date.
    - The table is sorted by date in descending order (most recent first) and by sport name alphabetically.
