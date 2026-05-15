import { agreementApi } from "../js/api/agreement.js";
import { carImageFor } from "../components/carCard.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { statusBadge } from "../components/status.js";
import { setState } from "../js/state.js";
import { escapeAttr, escapeHtml, formatDateHuman, formatMoney, getApiError } from "../js/utils.js";

function renderAgreementItem(item) {
  return `
    <article class="history-card">
      <img class="record-card__image" src="${escapeAttr(carImageFor(item.car))}" alt="${escapeAttr(item.car?.model || "Автомобиль")}" loading="lazy" />
      <div class="history-card__top">
        <span>Договор #${escapeHtml(item.agreement_id)}</span>
        ${statusBadge(item.status)}
      </div>
      <h2>${escapeHtml(item.car?.model || "Автомобиль")}</h2>
      <div class="history-card__meta">
        <span><i data-lucide="calendar"></i>${formatDateHuman(item.start_date)} — ${formatDateHuman(item.end_date)}</span>
        <span><i data-lucide="map-pin"></i>${escapeHtml(item.branch?.address || "Филиал")}</span>
      </div>
      <div class="history-card__bottom">
        <strong>${formatMoney(item.cost)}</strong>
        ${
          item.payment
            ? `<span class="payment-pill">${escapeHtml(item.payment.method)} · ${escapeHtml(item.payment.status)}</span>`
            : `<span class="payment-pill">Оплата не указана</span>`
        }
      </div>
    </article>
  `;
}

function renderHistoryContent(history) {
  if (!history.length) {
    return renderEmptyState("История бронирований отсутствует", "Здесь появятся подтверждённые и завершённые аренды", "clipboard-list");
  }

  return `
    <section class="history-list">
      ${history.map(renderAgreementItem).join("")}
    </section>
  `;
}

async function loadHistory() {
  const history = await agreementApi.history();
  setState({
    agreementHistory: history,
  });

  return history;
}

export async function renderHistoryPage(ctx) {
  renderLayout({
    title: "История",
    subtitle: "Брони и аренды",
    activeTab: "history",
    content: renderLoadingState("Собираем историю", "Проверяем активные и завершённые аренды"),
  });

  try {
    const history = await loadHistory();
    renderLayout({
      title: "История",
      subtitle: "Брони и аренды",
      activeTab: "history",
      content: renderHistoryContent(history),
    });
  } catch (error) {
    const apiError = getApiError(error, "Не удалось загрузить историю");
    renderLayout({
      title: "История",
      activeTab: "history",
      content: renderErrorState("История недоступна", apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderHistoryPage(ctx));
  }
}
