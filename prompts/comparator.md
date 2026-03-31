# GOAL

For every original key in EXTRACT_JSON:

- If both sources (Markdown and JSON) have the same semantic value → "correct".
- If both sources (Markdown and JSON) have no value (null, empty, None or not mentioned) → "correct".
- If both sources (Markdown and JSON) have different semantic values → "incorrect".
- If one source has a value and the other does not (null, empty, None or not mentioned) → "incorrect".

# DEFINITIONS

"No value" = null, empty string, empty array/object, or None or NOT MENTIONED in WEBSITE_MD.
"Same semantic value" = equal after normalizing case, whitespace, punctuation, trivial formatting; numbers equal within rounding; dates same after normalization (ISO-8601). Otherwise, treat as different.

# THINK (silently)

1. Parse EXTRACT_JSON. Flatten nested keys with dot-paths (e.g., "address.city").
2. Search WEBSITE_MD for each key’s concept/value.
3. Decide status per rules above.
4. Build output exactly matching SCHEMA.

# OUTPUT

Return **valid JSON** that conforms to SCHEMA. No extra text.

<SCHEMA>
"results": {
  "<dot_key>": {"status": "correct" | "incorrect", "json_value": any, "markdown_value": string | null}
  // ...one object per key from EXTRACT_JSON
}
</SCHEMA>

# INPUTS

<WEBSITE_MD>
{{MARKDOWN}}
</WEBSITE_MD>

<EXTRACT_JSON>
{{JSON}}
</EXTRACT_JSON>
</prompt>
