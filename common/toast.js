export let toasts = [];
let container;

function getContainer() {
  if (container) return container;
  container = document.createElement("div");
  container.className = "toast-container position-fixed bottom-0 end-0 p-3";
  document.body.appendChild(container);
  return container;
}

function build({ title = "", body = "", color = "bg-primary" }) {
  const html = `\n    <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">\n      <div class="toast-header ${color} text-white">\n        <strong class="me-auto">${title}</strong>\n        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>\n      </div>\n      <div class="toast-body">${body}</div>\n    </div>`;
  const parent = getContainer();
  parent.insertAdjacentHTML("beforeend", html);
  const element = parent.lastElementChild;
  const toast = new bootstrap.Toast(element);
  element.addEventListener("hidden.bs.toast", () => {
    toasts = toasts.filter((t) => t.element !== element);
    element.remove();
  });
  toasts.push({ element, toast });
  return { element, toast };
}

export function showToast(opts) {
  build(opts).toast.show();
}

export function updateLatestToast(opts) {
  if (!toasts.length) return showToast(opts);
  const { element, toast } = toasts[toasts.length - 1];
  if (opts.title) element.querySelector(".me-auto").textContent = opts.title;
  if (opts.body) element.querySelector(".toast-body").innerHTML = opts.body;
  if (opts.color) {
    element.querySelector(".toast-header").className = `toast-header ${opts.color} text-white`;
  }
  toast.show();
}

export function closeLatestToast() {
  if (!toasts.length) return;
  const { toast } = toasts[toasts.length - 1];
  toast.hide();
}

export function closeAllToasts() {
  toasts.slice().forEach(({ toast }) => toast.hide());
}
