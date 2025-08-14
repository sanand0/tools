# LLM Document Editor

Edit a document with natural language prompts. The prompt and document are sent to an LLM, which replies with a diff in [diff-match-patch](https://github.com/google/diff-match-patch) format. The diff is applied to the document in place.

Configure API keys with bootstrap-llm-provider. Form state persists with saveform. Errors and missing patches are shown using bootstrap-alert.
