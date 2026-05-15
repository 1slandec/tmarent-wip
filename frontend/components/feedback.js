import { escapeHtml } from "../js/utils.js";

export function renderLoadingState(title = "Загружаем", message = "Проверяем данные") {
  return `
    <section class="state state--loading">
      <div class="loader" aria-hidden="true"></div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

export function renderEmptyState(title, message, icon = "circle-off") {
  return `
    <section class="state">
      <div class="state__icon"><i data-lucide="${escapeHtml(icon)}"></i></div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

export function renderErrorState(title, message, retryLabel = "Повторить") {
  return `
    <section class="state state--error">
      <div class="state__icon"><i data-lucide="triangle-alert"></i></div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <button class="button button--primary" type="button" data-retry>
        <i data-lucide="refresh-cw"></i>
        <span>${escapeHtml(retryLabel)}</span>
      </button>
    </section>
  `;
}
