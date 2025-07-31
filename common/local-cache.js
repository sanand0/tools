const p = "cache.";
export const setCache = (k, d, t = 0) =>
  localStorage.setItem(p + k, JSON.stringify({ data: d, exp: t ? Date.now() + t : 0 }));
export const getCache = (k) => {
  const v = localStorage.getItem(p + k);
  if (!v) return null;
  const { data, exp } = JSON.parse(v);
  return exp && exp < Date.now() ? (localStorage.removeItem(p + k), null) : data;
};
export const removeCache = (k) => localStorage.removeItem(p + k);
