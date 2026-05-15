export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDateHuman(value) {
  if (!value) {
    return "—";
  }

  const date = parseIsoDate(`${value}`.slice(0, 10));
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeHuman(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso() {
  return toIsoDate(new Date());
}

export function diffDays(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end - start) / 86_400_000);
}

export function isPastDate(isoDate) {
  return isoDate < todayIso();
}

export function getApiError(error, fallback = "Что-то пошло не так") {
  return {
    code: error?.code || error?.error_code || "request_failed",
    message: error?.message || fallback,
    status: error?.status,
  };
}

export function hydrateIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2.2,
      },
    });
  }
}

export function pluralDays(days) {
  const value = Math.abs(Number(days));
  const last = value % 10;
  const lastTwo = value % 100;

  if (last === 1 && lastTwo !== 11) {
    return `${days} день`;
  }
  if (last >= 2 && last <= 4 && (lastTwo < 10 || lastTwo >= 20)) {
    return `${days} дня`;
  }
  return `${days} дней`;
}
