export const download = (d, n) => {
  const u = URL.createObjectURL(d instanceof Blob ? d : new Blob([d]));
  Object.assign(document.createElement("a"), { href: u, download: n }).click();
  URL.revokeObjectURL(u);
};
