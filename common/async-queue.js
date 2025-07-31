export const runQueue = async (t, o) => {
  const r = [];
  for (let i = 0; i < t.length; i++) {
    r.push(await t[i]());
    o && o(i + 1, t.length);
  }
  return r;
};
