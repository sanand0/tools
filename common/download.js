const objectUrl = (blob) => URL.createObjectURL(blob);
const downloadBlob = (blob, filename) => {
  const url = objectUrl(blob);
  document.body.insertAdjacentHTML("beforeend", `<a href="${url}" download="${filename}"></a>`);
  const a = document.body.lastElementChild;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
export { objectUrl, downloadBlob };
