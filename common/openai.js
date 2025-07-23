import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";

const cfgURL = new URL("../openai.json", import.meta.url);
const { defaultBaseUrls } = await fetch(cfgURL).then((r) => r.json());

export function loadOpenAI(show = false) {
  return openaiConfig({ defaultBaseUrls, show });
}
