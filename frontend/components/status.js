import { escapeHtml } from "../js/utils.js";

const LABELS = {
  available: "Свободен",
  reserved: "Зарезервирован",
  rented: "В аренде",
  maintenance: "Сервис",
  pending: "Ожидает",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  expired: "Истекла",
  active: "Активна",
  completed: "Завершена",
  paid: "Оплачено",
  failed: "Ошибка",
};

export function statusLabel(status) {
  return LABELS[status] || status || "—";
}

export function statusBadge(status) {
  return `
    <span class="status status--${escapeHtml(status || "unknown")}">
      ${escapeHtml(statusLabel(status))}
    </span>
  `;
}
