export const fetchJson = async (u, o) => {
  const r = await fetch(u, o);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
};
export const fetchText = async (u, o) => {
  const r = await fetch(u, o);
  if (!r.ok) throw new Error(r.statusText);
  return r.text();
};
