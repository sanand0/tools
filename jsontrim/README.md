# JSON String Trimmer

This tool recursively traverses a JSON object or array and truncates string values that exceed a user-specified maximum length.

## What it does

The JSON String Trimmer processes an input JSON structure. For every string value found within the JSON (whether at the top level or nested within objects or arrays), it checks if its length is greater than the defined maximum. If it is, the string is shortened to this maximum length. Other data types (numbers, booleans, nulls, objects, arrays themselves) are preserved, though strings within nested structures are also subject to trimming.

## Use Cases

-   **Reducing JSON Size:** Shorten lengthy string values to reduce the overall size of a JSON payload, which can be beneficial for network transmission or storage.
-   **Data Sanitization/Anonymization (Basic):** Truncate potentially long user-generated content or log entries to a manageable or less revealing size. (Note: For true anonymization, more sophisticated techniques are needed).
-   **Preview Generation:** Create a summarized version of a JSON object by shortening all its string fields, useful for displaying previews.
-   **Schema Adherence:** Ensure string fields do not exceed character limits imposed by certain database schemas or API contracts.
-   **Improving Readability:** Shorten very long strings to make the JSON structure more readable during development or debugging.

## How It Works

1.  **Input JSON:** The user pastes their JSON data into the "Input JSON" textarea. The tool remembers the last input using browser localStorage.
2.  **Set Maximum Length:** The user specifies the maximum desired length for string values in the "Max characters per string" input field. This defaults to 200 characters.
3.  **Trim Strings:** The user clicks the "Trim Strings" button.
    *   The tool parses the input JSON. If the JSON is invalid, an error message is displayed.
    *   It then recursively walks through the JSON structure.
    *   If a string value's length is greater than the specified maximum, it is truncated (e.g., ` "verylongstring".slice(0, maxLen)`).
    *   The modified JSON, with all applicable strings trimmed, is displayed in the "Trimmed JSON" textarea, pretty-printed with an indent of 2 spaces.
4.  **Copy Result:** The user can click the "Copy Result" button to copy the trimmed JSON to their clipboard.

An error message is shown if the input is not valid JSON or if the maximum length is less than 1.
