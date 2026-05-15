import { carImageFor } from "../components/carCard.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { statusBadge, statusLabel } from "../components/status.js";
import { showToast } from "../components/toast.js";
import { findCarWithBranch } from "../js/dataLoaders.js";
import { isProfileCompleted } from "../js/profile.js";
import { appState } from "../js/state.js";
import { escapeAttr, escapeHtml, formatMoney, getApiError } from "../js/utils.js";

function unavailableReason(car) {
  if (car.status === "maintenance") {
    return "Автомобиль на обслуживании";
  }
  // if (car.status !== "available") {
  //   return "Автомобиль сейчас недоступен";
  // }
  if (!isProfileCompleted(appState.user)) {
    return "PROFILE_INCOMPLETE";
  }
  return "";
}

function renderDetail(car) {
  const reason = unavailableReason(car);
  const canBook = !reason;

  return `
    <section class="detail-hero">
      <img src="${escapeAttr(carImageFor(car))}" alt="${escapeAttr(car.model)}" />
      <div class="detail-hero__badge">${statusBadge(car.status)}</div>
    </section>

    <section class="detail-title">
      <div>
        <p>${escapeHtml(car.year)} год</p>
        <h2>${escapeHtml(car.model)}</h2>
      </div>
      <div class="detail-title__price">
        <strong>${formatMoney(car.price_per_day)}</strong>
        <span>в день</span>
      </div>
    </section>

    ${
      !isProfileCompleted(appState.user)
        ? `
          <section class="notice notice--warning">
            <i data-lucide="circle-alert"></i>
            <span>Заполните профиль перед бронированием</span>
          </section>
        `
        : ""
    }

    <section class="info-panel">
      <h3>О машине</h3>
      <div class="info-grid">
        <div>
          <span>Модель</span>
          <strong>${escapeHtml(car.model)}</strong>
        </div>
        <div>
          <span>Год</span>
          <strong>${escapeHtml(car.year)}</strong>
        </div>
        <div>
          <span>Статус</span>
          <strong>${escapeHtml(statusLabel(car.status))}</strong>
        </div>
        <div>
          <span>Стоимость</span>
          <strong>${formatMoney(car.price_per_day)}</strong>
        </div>
      </div>
    </section>

    <section class="info-panel">
      <h3>Филиал</h3>
      <div class="branch-address">
        <i data-lucide="map-pin"></i>
        <span>${escapeHtml(car.branch?.address || "Адрес филиала не указан")}</span>
      </div>
    </section>

    <button class="button button--primary button--wide" type="button" data-book-car="${escapeAttr(car.car_id)}" ${canBook ? "" : "disabled"}>
      <i data-lucide="calendar-plus"></i>
      <span>${canBook ? "Забронировать" : reason}</span>
    </button>
  `;
}

export async function renderCarDetailPage(ctx) {
  const carId = Number(ctx.params.carId);
  renderLayout({
    title: "Автомобиль",
    activeTab: "cars",
    showBack: true,
    content: renderLoadingState("Открываем карточку", "Проверяем данные автомобиля"),
  });

  try {
    const car = await findCarWithBranch(carId);
    if (!car) {
      renderLayout({
        title: "Автомобиль",
        activeTab: "cars",
        showBack: true,
        content: renderEmptyState("Авто не найдено", "Возможно, оно больше не доступно в выбранном филиале", "car-front"),
      });
      return;
    }

    renderLayout({
      title: "Автомобиль",
      subtitle: car.branch?.address || "",
      activeTab: "cars",
      showBack: true,
      content: renderDetail(car),
    });

    document.querySelector("[data-book-car]")?.addEventListener("click", () => {
      const reason = unavailableReason(car);
      if (reason === "PROFILE_INCOMPLETE") {
        showToast("PROFILE_INCOMPLETE: Заполните профиль перед бронированием", "error");
        return;
      }
      if (reason) {
        showToast(reason, "error");
        return;
      }

      ctx.navigate("booking", { carId: car.car_id });
    });
  } catch (error) {
    const apiError = getApiError(error, "Не удалось открыть карточку автомобиля");
    renderLayout({
      title: "Автомобиль",
      activeTab: "cars",
      showBack: true,
      content: renderErrorState("Карточка недоступна", apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderCarDetailPage(ctx));
  }
}
