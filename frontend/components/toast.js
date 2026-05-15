import { escapeHtml } from "../js/utils.js";

let toastTimer = null;

export function showToast(message, variant = "default") {
  const root = document.querySelector("#toast-root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="toast toast--${variant}">
      ${escapeHtml(message)}
    </div>
  `;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    root.innerHTML = "";
  }, 3400);
}
