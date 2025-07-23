import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";

export function loadOpenAI(defaultBaseUrls, show = false) {
  return openaiConfig({ defaultBaseUrls, show });
}
