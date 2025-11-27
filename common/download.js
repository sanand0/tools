const objectUrl = (blob) => URL.createObjectURL(blob);
const downloadBlob = (blob, filename) => {
  const url = objectUrl(blob);
  document.body.insertAdjacentHTML("beforeend", `<a href="${url}" download="${filename}"></a>`);
  const a = document.body.lastElementChild;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export { downloadBlob, objectUrl, fileToDataUrl };
