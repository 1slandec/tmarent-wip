import { bookingApi } from "../js/api/booking.js";
import { carImageFor } from "../components/carCard.js";
import { renderCalendar } from "../components/calendar.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { showToast } from "../components/toast.js";
import { findCarWithBranch } from "../js/dataLoaders.js";
import { isProfileCompleted } from "../js/profile.js";
import { appState } from "../js/state.js";
import {
  diffDays,
  escapeAttr,
  escapeHtml,
  formatDateHuman,
  formatMoney,
  getApiError,
  parseIsoDate,
  pluralDays,
} from "../js/utils.js";

let selection = {
  carId: null,
  startDate: null,
  endDate: null,
  monthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  availability: null,
  availabilityLoading: false,
  availabilityError: null,
  creating: false,
};

function resetSelection(carId) {
  selection = {
    carId,
    startDate: null,
    endDate: null,
    monthDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    availability: null,
    availabilityLoading: false,
    availabilityError: null,
    creating: false,
  };
}

function selectedDays() {
  if (!selection.startDate || !selection.endDate) {
    return 0;
  }
  return Math.max(diffDays(selection.startDate, selection.endDate), 0);
}

function renderAvailability() {
  if (selection.availabilityLoading) {
    return `
      <div class="availability availability--loading">
        <div class="loader loader--small"></div>
        <span>Проверяем доступность</span>
      </div>
    `;
  }

  if (selection.availabilityError) {
    return `
      <div class="availability availability--error">
        <i data-lucide="triangle-alert"></i>
        <span>${escapeHtml(selection.availabilityError)}</span>
      </div>
    `;
  }

  if (!selection.availability) {
    return `
      <div class="availability">
        <i data-lucide="calendar-days"></i>
        <span>Выберите начало и конец аренды</span>
      </div>
    `;
  }

  return `
    <div class="availability ${selection.availability.is_available ? "availability--ok" : "availability--error"}">
      <i data-lucide="${selection.availability.is_available ? "badge-check" : "circle-x"}"></i>
      <span>${escapeHtml(selection.availability.message)}</span>
    </div>
  `;
}

function renderBookingContent(car) {
  const days = selectedDays();
  const total = days * Number(car.price_per_day || 0);
  const profileCompleted = isProfileCompleted(appState.user);
  const canCreate =
    profileCompleted &&
    days > 0 &&
    selection.availability?.is_available &&
    !selection.availabilityLoading &&
    !selection.creating;

  return `
    <section class="booking-car">
      <img src="${escapeAttr(carImageFor(car))}" alt="${escapeAttr(car.model)}" />
      <div>
        <p>${escapeHtml(car.branch?.address || "Филиал")}</p>
        <h2>${escapeHtml(car.model)}</h2>
        <span>${formatMoney(car.price_per_day)} в день</span>
      </div>
    </section>

    ${
      !profileCompleted
        ? `
          <section class="notice notice--warning">
            <i data-lucide="circle-alert"></i>
            <span>Заполните профиль перед бронированием</span>
          </section>
        `
        : ""
    }

    ${renderCalendar(selection)}

    <section class="booking-summary">
      <div>
        <span>Даты</span>
        <strong>
          ${
            selection.startDate && selection.endDate
              ? `${formatDateHuman(selection.startDate)} — ${formatDateHuman(selection.endDate)}`
              : "Диапазон не выбран"
          }
        </strong>
      </div>
      <div>
        <span>Срок</span>
        <strong>${days ? pluralDays(days) : "—"}</strong>
      </div>
      <div>
        <span>Итого</span>
        <strong>${formatMoney(total)}</strong>
      </div>
    </section>

    ${renderAvailability()}

    <button class="button button--primary button--wide" type="button" data-create-booking ${canCreate ? "" : "disabled"}>
      <i data-lucide="${selection.creating ? "loader-circle" : "check"}"></i>
      <span>${selection.creating ? "Создаём бронь" : "Создать предварительное бронирование"}</span>
    </button>
  `;
}

async function checkAvailability(ctx, car) {
  selection.availabilityLoading = true;
  selection.availabilityError = null;
  selection.availability = null;
  renderBookingReady(ctx, car);

  try {
    selection.availability = await bookingApi.checkAvailability({
      car_id: Number(car.car_id),
      start_date: selection.startDate,
      end_date: selection.endDate,
    });
  } catch (error) {
    const apiError = getApiError(error, "Не удалось проверить доступность");
    selection.availabilityError = apiError.message;
  } finally {
    selection.availabilityLoading = false;
    renderBookingReady(ctx, car);
  }
}

function handleDayClick(ctx, car, isoDate) {
  if (!selection.startDate || selection.endDate) {
    selection.startDate = isoDate;
    selection.endDate = null;
    selection.availability = null;
    selection.availabilityError = null;
    renderBookingReady(ctx, car);
    return;
  }

  if (isoDate <= selection.startDate) {
    selection.startDate = isoDate;
    selection.endDate = null;
    selection.availability = null;
    selection.availabilityError = null;
    renderBookingReady(ctx, car);
    return;
  }

  selection.endDate = isoDate;
  checkAvailability(ctx, car);
}

function bindBookingEvents(ctx, car) {
  document.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
    selection.monthDate = new Date(selection.monthDate.getFullYear(), selection.monthDate.getMonth() - 1, 1);
    renderBookingReady(ctx, car);
  });

  document.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
    selection.monthDate = new Date(selection.monthDate.getFullYear(), selection.monthDate.getMonth() + 1, 1);
    renderBookingReady(ctx, car);
  });

  document.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      handleDayClick(ctx, car, button.dataset.calendarDay);
    });
  });

  document.querySelector("[data-create-booking]")?.addEventListener("click", async () => {
    if (!isProfileCompleted(appState.user)) {
      showToast("PROFILE_INCOMPLETE: Заполните профиль перед бронированием", "error");
      return;
    }

    if (!selection.availability?.is_available) {
      showToast("Сначала выберите доступный диапазон дат", "error");
      return;
    }

    selection.creating = true;
    renderBookingReady(ctx, car);

    try {
      const booking = await bookingApi.create({
        car_id: Number(car.car_id),
        start_date: selection.startDate,
        end_date: selection.endDate,
      });
      showToast("Предварительное бронирование создано. Чтобы подтвердить бронь, оплатите её в профиле.", "success");
      ctx.navigate("profile", {}, { resetStack: true });
    } catch (error) {
      const apiError = getApiError(error, "Не удалось создать бронь");
      showToast(apiError.message, "error");
      selection.creating = false;
      renderBookingReady(ctx, car);
    }
  });
}

function renderBookingReady(ctx, car) {
  renderLayout({
    title: "Бронирование",
    subtitle: car.model,
    activeTab: "cars",
    showBack: true,
    content: renderBookingContent(car),
  });
  bindBookingEvents(ctx, car);
}

export async function renderBookingPage(ctx) {
  const carId = Number(ctx.params.carId);
  if (selection.carId !== carId) {
    resetSelection(carId);
  }

  renderLayout({
    title: "Бронирование",
    activeTab: "cars",
    showBack: true,
    content: renderLoadingState("Готовим календарь", "Открываем даты для бронирования"),
  });

  try {
    const car = await findCarWithBranch(carId);
    if (!car) {
      renderLayout({
        title: "Бронирование",
        activeTab: "cars",
        showBack: true,
        content: renderEmptyState("Авто не найдено", "Вернитесь к списку и выберите другой автомобиль", "car-front"),
      });
      return;
    }

    // if (car.status !== "available") {
    //   renderLayout({
    //     title: "Бронирование",
    //     activeTab: "cars",
    //     showBack: true,
    //     content: renderEmptyState("Бронирование недоступно", "Этот автомобиль сейчас нельзя забронировать", "calendar-x"),
    //   });
    //   return;
    // }

    renderBookingReady(ctx, car);
  } catch (error) {
    const apiError = getApiError(error, "Не удалось открыть бронирование");
    renderLayout({
      title: "Бронирование",
      activeTab: "cars",
      showBack: true,
      content: renderErrorState("Календарь недоступен", apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderBookingPage(ctx));
  }
}
