// common/ui.js
/**
 * Displays a Bootstrap toast notification.
 * @param {string} message The message to display.
 * @param {string} type The Bootstrap background color class (e.g., 'bg-success', 'bg-danger').
 */
export function showToast(message, type = 'bg-primary') {
  let toastElement = document.getElementById('toast-container');
  if (!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'toast-container';
    toastElement.style.position = 'fixed';
    toastElement.style.bottom = '20px';
    toastElement.style.right = '20px';
    toastElement.style.zIndex = '1050'; // Ensure it's above most elements
    document.body.appendChild(toastElement);
  }

  const toastId = `toast-${Date.now()}`;
  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white ${type} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="5000">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  toastElement.insertAdjacentHTML('beforeend', toastHTML);

  const newToast = document.getElementById(toastId);
  // Ensure bootstrap is loaded and Toast is available
  if (typeof bootstrap !== 'undefined' && typeof bootstrap.Toast !== 'undefined') {
    const bsToast = new bootstrap.Toast(newToast);
    bsToast.show();
    newToast.addEventListener('hidden.bs.toast', () => {
      newToast.remove();
    });
  } else {
    console.error('Bootstrap Toast undefined. Make sure Bootstrap JS is loaded.');
    // Fallback for visibility if bootstrap isn't loaded for some reason
    setTimeout(() => {
      newToast.remove();
    }, 5000);
  }
}
