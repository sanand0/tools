const configCache = new Map();

const urlParams = () => new URLSearchParams(window.location.search);

const readParam = (name, { fallback = "", trim = true } = {}) => {
  const raw = urlParams().get(name);
  if (raw === null) return fallback;
  return trim ? raw.trim() : raw;
};

const readIntParam = (name, { fallback = null, min = null, max = null } = {}) => {
  const raw = readParam(name, { fallback: "", trim: true });
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  if (min !== null && value < min) return fallback;
  if (max !== null && value > max) return fallback;
  return value;
};

const readListParam = (name, { fallback = [], split = /[,\n]+/, trim = true, maxItems = 200 } = {}) => {
  const raw = readParam(name, { fallback: "", trim: false });
  if (!raw) return fallback;
  const parts = raw
    .split(split)
    .map((part) => (trim ? part.trim() : part))
    .filter(Boolean);
  return parts.slice(0, maxItems);
};

const loadConfigJson = async (url = "config.json") => {
  if (configCache.has(url)) return configCache.get(url);
  const promise = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    return await response.json();
  });
  configCache.set(url, promise);
  return await promise;
};

export { loadConfigJson, readIntParam, readListParam, readParam, urlParams };
