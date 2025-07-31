export const showLoading = (e, t = "") => {
  e.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>${t}`;
  e.classList.remove("d-none");
};
export const hideLoading = (e) => {
  e.classList.add("d-none");
  e.innerHTML = "";
};
