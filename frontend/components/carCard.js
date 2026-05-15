import { statusBadge } from "./status.js";
import { escapeAttr, escapeHtml, formatMoney } from "../js/utils.js";

export const DEFAULT_CAR_IMAGE = "/assets/images/car-default.png";

export function carImageFor(car) {
  return car?.image_url?.trim() || DEFAULT_CAR_IMAGE;
}

export function renderCarCard(car, branch) {
  const isBookable = car.status === "available";
  return `
    <article class="car-card" data-open-car="${escapeAttr(car.car_id)}">
      <div class="car-card__image">
        <img src="${escapeAttr(carImageFor(car))}" alt="${escapeAttr(car.model)}" loading="lazy" />
        <div class="car-card__status">${statusBadge(car.status)}</div>
      </div>
      <div class="car-card__body">
        <div>
          <h2>${escapeHtml(car.model)}</h2>
          <p>${escapeHtml(car.year)} год</p>
        </div>
        <div class="car-card__price">
          <strong>${formatMoney(car.price_per_day)}</strong>
          <span>в день</span>
        </div>
      </div>
      <div class="car-card__footer">
        <span>
          <i data-lucide="map-pin"></i>
          ${escapeHtml(branch?.address || "Филиал не указан")}
        </span>
        <button class="button button--ghost" type="button" data-open-car="${escapeAttr(car.car_id)}">
          <span>${isBookable ? "Подробнее" : "Смотреть"}</span>
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
    </article>
  `;
}
