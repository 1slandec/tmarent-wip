import { agreementApi } from "../js/api/agreement.js";
import { bookingApi } from "../js/api/booking.js";
import { userApi } from "../js/api/user.js";
import { carImageFor } from "../components/carCard.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { statusBadge } from "../components/status.js";
import { showToast } from "../components/toast.js";
import { withProfileCompletion } from "../js/profile.js";
import { appState, setState } from "../js/state.js";
import {
  escapeAttr,
  escapeHtml,
  formatDateHuman,
  formatDateTimeHuman,
  formatMoney,
  getApiError,
  hydrateIcons,
} from "../js/utils.js";

let paymentConfirming = false;
let paymentBookingId = null;
let cancelConfirming = false;
let cancelBookingId = null;

function field(label, value) {
  return `
    <div class="profile-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Не указано")}</strong>
    </div>
  `;
}

function confirmPaymentErrorMessage(error) {
  const code = String(error?.code || error?.error_code || "").toUpperCase();
  if (code === "BOOKING_EXPIRED") {
    return "Срок действия брони истёк";
  }
  if (code === "INVALID_BOOKING_STATE") {
    return "Бронь нельзя подтвердить в текущем статусе";
  }
  if (code === "USER_MISMATCH") {
    return "Эта бронь принадлежит другому пользователю";
  }
  return "Не удалось подтвердить оплату";
}

function renderPaymentConfirmModal() {
  return `
    <div class="modal-backdrop is-hidden" data-payment-modal aria-hidden="true">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="payment-confirm-title">
        <div class="modal__header">
          <div>
            <p>Оплата</p>
            <h2 id="payment-confirm-title">Подтвердить оплату бронирования?</h2>
          </div>
          <button class="icon-button" type="button" data-payment-modal-close aria-label="Закрыть">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal__body">
          <p>Это тестовая оплата для MVP. Реальные деньги не списываются.</p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-payment-modal-close>
              <span>Отмена</span>
            </button>
            <button class="button button--primary" type="button" data-confirm-payment>
              <i data-lucide="credit-card"></i>
              <span>Подтвердить оплату</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderCancelBookingModal() {
  return `
    <div class="modal-backdrop is-hidden" data-cancel-modal aria-hidden="true">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
        <div class="modal__header">
          <div>
            <p>Бронирование</p>
            <h2 id="cancel-booking-title">Отменить текущую бронь?</h2>
          </div>
          <button class="icon-button" type="button" data-cancel-modal-close aria-label="Закрыть">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal__body">
          <p>После отмены эту бронь нельзя будет вернуть обратно.</p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-cancel-modal-close>
              <span>Назад</span>
            </button>
            <button class="button button--danger" type="button" data-confirm-cancel-booking>
              <i data-lucide="x"></i>
              <span>Отменить бронь</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderProfileEditModal(user) {
  return `
    <div class="modal-backdrop is-hidden" data-profile-modal aria-hidden="true">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <div class="modal__header">
          <div>
            <p>Профиль</p>
            <h2 id="profile-edit-title">Редактировать данные</h2>
          </div>
          <button class="icon-button" type="button" data-profile-modal-close aria-label="Закрыть">
            <i data-lucide="x"></i>
          </button>
        </div>
        <form class="profile-form" data-profile-form>
          <label class="form-field">
            <span>full_name</span>
            <input
              type="text"
              name="full_name"
              autocomplete="name"
              maxlength="100"
              required
              value="${escapeAttr(user.full_name || "")}"
            />
          </label>
          <label class="form-field">
            <span>age</span>
            <input
              type="number"
              name="age"
              inputmode="numeric"
              min="18"
              max="120"
              required
              value="${escapeAttr(user.age || "")}"
            />
          </label>
          <label class="form-field">
            <span>license_no</span>
            <input
              type="text"
              name="license_no"
              autocomplete="off"
              maxlength="20"
              required
              value="${escapeAttr(user.license_no || "")}"
            />
          </label>
          <button class="button button--primary button--wide" type="submit" data-profile-save>
            <i data-lucide="save"></i>
            <span>Сохранить</span>
          </button>
        </form>
      </section>
    </div>
  `;
}

function renderActiveBooking(booking) {
  if (!booking) {
    return renderEmptyState("Активная бронь отсутствует", "Выберите авто и создайте предварительное бронирование", "calendar-plus");
  }

  return `
    <article class="booking-card">
      <img class="record-card__image" src="${escapeAttr(carImageFor(booking.car))}" alt="${escapeAttr(booking.car?.model || "Автомобиль")}" loading="lazy" />
      <div class="booking-card__top">
        <div>
          <span>Бронь #${escapeHtml(booking.booking_id)}</span>
          <h3>${escapeHtml(booking.car?.model || "Автомобиль")}</h3>
        </div>
        ${statusBadge(booking.status)}
      </div>
      <div class="booking-card__meta">
        <span><i data-lucide="calendar"></i>${formatDateHuman(booking.start_date)} — ${formatDateHuman(booking.end_date)}</span>
        <span><i data-lucide="timer"></i>До ${formatDateTimeHuman(booking.reserved_until)}</span>
        <span><i data-lucide="map-pin"></i>${escapeHtml(booking.branch?.address || "Филиал")}</span>
      </div>
      <div class="booking-card__bottom">
        <strong>${formatMoney(booking.total_price)}</strong>
        <div class="booking-card__actions">
          ${
            booking.status === "pending"
              ? `
                <button class="button button--primary" type="button" data-pay-booking="${escapeHtml(booking.booking_id)}">
                  <i data-lucide="credit-card"></i>
                  <span>Оплатить</span>
                </button>
              `
              : ""
          }
          <button class="button button--danger" type="button" data-cancel-booking="${escapeHtml(booking.booking_id)}">
            <i data-lucide="x"></i>
            <span>Отменить</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderActiveRental(history) {
  const active = history.find((item) => item.status === "active");
  if (!active) {
    return renderEmptyState("Активной аренды нет", "Здесь появится текущая аренда после оформления договора", "key-round");
  }

  return `
    <article class="booking-card">
      <img class="record-card__image" src="${escapeAttr(carImageFor(active.car))}" alt="${escapeAttr(active.car?.model || "Автомобиль")}" loading="lazy" />
      <div class="booking-card__top">
        <div>
          <span>Договор #${escapeHtml(active.agreement_id)}</span>
          <h3>${escapeHtml(active.car?.model || "Автомобиль")}</h3>
        </div>
        ${statusBadge(active.status)}
      </div>
      <div class="booking-card__meta">
        <span><i data-lucide="calendar"></i>${formatDateHuman(active.start_date)} — ${formatDateHuman(active.end_date)}</span>
        <span><i data-lucide="map-pin"></i>${escapeHtml(active.branch?.address || "Филиал")}</span>
      </div>
      <div class="booking-card__bottom">
        <strong>${formatMoney(active.cost)}</strong>
      </div>
    </article>
  `;
}

function renderProfileContent(user, booking, history) {
  return `
    ${
      !user.profile_completed
        ? `
          <section class="notice notice--warning">
            <i data-lucide="circle-alert"></i>
            <span>Заполните профиль перед бронированием</span>
          </section>
        `
        : ""
    }

    <section class="profile-card">
      <div class="profile-card__avatar">
        <i data-lucide="user-round"></i>
      </div>
      <div class="profile-card__body">
        <p>@${escapeHtml(user.username || "telegram")}</p>
        <h2>${escapeHtml(user.full_name || "Пользователь")}</h2>
      </div>
      <button class="icon-button profile-card__edit" type="button" data-profile-edit aria-label="Редактировать профиль">
        <i data-lucide="pencil"></i>
      </button>
    </section>

    <section class="info-panel">
      <h3>Данные пользователя</h3>
      <div class="profile-grid">
        ${field("ФИО", user.full_name)}
        ${field("Возраст", user.age)}
        ${field("Права", user.license_no)}
        ${field("Telegram ID", user.telegram_id)}
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>Текущая бронь</h2>
      </div>
      ${renderActiveBooking(booking)}
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>Активная аренда</h2>
      </div>
      ${renderActiveRental(history)}
    </section>

    ${renderProfileEditModal(user)}
    ${renderPaymentConfirmModal()}
    ${renderCancelBookingModal()}
  `;
}

async function loadProfileData() {
  const [userResult, bookingResult, historyResult] = await Promise.allSettled([
    userApi.me(),
    bookingApi.active(),
    agreementApi.history(),
  ]);

  if (userResult.status === "rejected") {
    throw userResult.reason;
  }

  const user = withProfileCompletion(userResult.value);
  const activeBooking = bookingResult.status === "fulfilled" ? bookingResult.value : null;
  const pendingBooking = activeBooking?.status === "pending" ? activeBooking : null;
  const history = historyResult.status === "fulfilled" ? historyResult.value : [];

  setState({
    user,
    activeBooking: pendingBooking,
    agreementHistory: history,
  });

  return { user, booking: pendingBooking, history };
}

function bindProfileEvents(ctx) {
  const modal = document.querySelector("[data-profile-modal]");
  const form = document.querySelector("[data-profile-form]");
  const paymentModal = document.querySelector("[data-payment-modal]");
  const cancelModal = document.querySelector("[data-cancel-modal]");
  const openModal = () => {
    modal?.classList.remove("is-hidden");
    modal?.setAttribute("aria-hidden", "false");
    form?.elements.full_name?.focus();
  };
  const closeModal = () => {
    modal?.classList.add("is-hidden");
    modal?.setAttribute("aria-hidden", "true");
  };
  const openPaymentModal = (bookingId) => {
    paymentBookingId = Number(bookingId);
    paymentModal?.classList.remove("is-hidden");
    paymentModal?.setAttribute("aria-hidden", "false");
  };
  const closePaymentModal = () => {
    if (paymentConfirming) {
      return;
    }
    paymentModal?.classList.add("is-hidden");
    paymentModal?.setAttribute("aria-hidden", "true");
    paymentBookingId = null;
  };
  const openCancelModal = (bookingId) => {
    cancelBookingId = Number(bookingId);
    cancelModal?.classList.remove("is-hidden");
    cancelModal?.setAttribute("aria-hidden", "false");
  };
  const closeCancelModal = () => {
    if (cancelConfirming) {
      return;
    }
    cancelModal?.classList.add("is-hidden");
    cancelModal?.setAttribute("aria-hidden", "true");
    cancelBookingId = null;
  };

  document.querySelector("[data-profile-edit]")?.addEventListener("click", openModal);
  document.querySelector("[data-profile-modal-close]")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  paymentModal?.addEventListener("click", (event) => {
    if (event.target === paymentModal) {
      closePaymentModal();
    }
  });
  cancelModal?.addEventListener("click", (event) => {
    if (event.target === cancelModal) {
      closeCancelModal();
    }
  });
  document.querySelectorAll("[data-payment-modal-close]").forEach((button) => {
    button.addEventListener("click", closePaymentModal);
  });
  document.querySelectorAll("[data-cancel-modal-close]").forEach((button) => {
    button.addEventListener("click", closeCancelModal);
  });
  document.querySelector("[data-pay-booking]")?.addEventListener("click", (event) => {
    openPaymentModal(event.currentTarget.dataset.payBooking);
  });
  document.querySelector("[data-confirm-payment]")?.addEventListener("click", async (event) => {
    if (paymentConfirming || !paymentBookingId) {
      return;
    }

    paymentConfirming = true;
    const button = event.currentTarget;
    button.setAttribute("disabled", "");
    button.innerHTML = `<i data-lucide="loader-circle"></i><span>Подтверждаем</span>`;
    hydrateIcons();

    try {
      await bookingApi.confirmBooking(paymentBookingId, "card");
      paymentModal?.classList.add("is-hidden");
      paymentModal?.setAttribute("aria-hidden", "true");
      paymentBookingId = null;
      showToast("Бронь оплачена и подтверждена", "success");
      await renderProfilePage(ctx);
    } catch (error) {
      showToast(confirmPaymentErrorMessage(error), "error");
    } finally {
      paymentConfirming = false;
      button.removeAttribute("disabled");
      button.innerHTML = `<i data-lucide="credit-card"></i><span>Подтвердить оплату</span>`;
      hydrateIcons();
    }
  });
  document.querySelector("[data-cancel-booking]")?.addEventListener("click", (event) => {
    openCancelModal(event.currentTarget.dataset.cancelBooking);
  });
  document.querySelector("[data-confirm-cancel-booking]")?.addEventListener("click", async (event) => {
    if (cancelConfirming || !cancelBookingId) {
      return;
    }

    cancelConfirming = true;
    const button = event.currentTarget;
    button.setAttribute("disabled", "");
    button.innerHTML = `<i data-lucide="loader-circle"></i><span>Отменяем</span>`;
    hydrateIcons();

    try {
      const result = await bookingApi.cancel(cancelBookingId);
      cancelModal?.classList.add("is-hidden");
      cancelModal?.setAttribute("aria-hidden", "true");
      cancelBookingId = null;
      showToast(result.message || "Бронирование отменено", "success");
      await renderProfilePage(ctx);
    } catch (error) {
      const apiError = getApiError(error, "Не удалось отменить бронь");
      showToast(apiError.message, "error");
    } finally {
      cancelConfirming = false;
      button.removeAttribute("disabled");
      button.innerHTML = `<i data-lucide="x"></i><span>Отменить бронь</span>`;
      hydrateIcons();
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      full_name: String(formData.get("full_name") || "").trim(),
      age: Number(formData.get("age")),
      license_no: String(formData.get("license_no") || "").trim(),
    };

    if (!payload.full_name || !payload.license_no || !Number.isFinite(payload.age)) {
      showToast("Заполните все поля профиля", "error");
      return;
    }

    if (payload.age < 18) {
      showToast("Возраст должен быть не меньше 18", "error");
      return;
    }

    const saveButton = document.querySelector("[data-profile-save]");
    saveButton?.setAttribute("disabled", "");

    try {
      const updatedUser = withProfileCompletion(await userApi.updateMe(payload));
      setState({ user: updatedUser });
      showToast("Профиль сохранён", "success");
      closeModal();
      await renderProfilePage(ctx);
    } catch (error) {
      const apiError = getApiError(error, "Не удалось сохранить профиль");
      showToast(apiError.message, "error");
    } finally {
      saveButton?.removeAttribute("disabled");
    }
  });

}

export async function renderProfilePage(ctx) {
  renderLayout({
    title: "Профиль",
    subtitle: "Бронь, аренда и данные",
    activeTab: "profile",
    content: renderLoadingState("Открываем профиль", "Загружаем данные пользователя"),
  });

  try {
    const { user, booking, history } = await loadProfileData();
    renderLayout({
      title: "Профиль",
      subtitle: "Бронь, аренда и данные",
      activeTab: "profile",
      content: renderProfileContent(user, booking, history),
    });
    bindProfileEvents(ctx);
  } catch (error) {
    const apiError = getApiError(error, "Не удалось загрузить профиль");
    renderLayout({
      title: "Профиль",
      activeTab: "profile",
      content: renderErrorState("Профиль недоступен", apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderProfilePage(ctx));
  }
}
