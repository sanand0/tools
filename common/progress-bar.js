export const startProgress = (e, t) => {
  e.innerHTML = '<div class="progress"><div class="progress-bar" role="progressbar" style="width:0%"></div></div>';
  e.dataset.total = t;
};
export const updateProgress = (e, v) =>
  (e.querySelector(".progress-bar").style.width = `${(v / e.dataset.total) * 100}%`);
export const finishProgress = (e) => updateProgress(e, e.dataset.total);
