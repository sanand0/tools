export const copyText = async (t) => {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: t });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
};
export const pasteText = () => navigator.clipboard.readText();
