import { escapeAttr, escapeHtml, isPastDate, toIsoDate } from "../js/utils.js";

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthLabel(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const days = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function isInRange(iso, startIso, endIso) {
  return Boolean(startIso && endIso && iso > startIso && iso < endIso);
}

export function renderCalendar({ monthDate, startDate, endDate }) {
  const days = getCalendarDays(monthDate);
  const title = monthLabel(monthDate);

  return `
    <section class="calendar" aria-label="Выбор дат бронирования">
      <div class="calendar__header">
        <button class="icon-button" type="button" data-calendar-prev aria-label="Предыдущий месяц">
          <i data-lucide="chevron-left"></i>
        </button>
        <h2>${escapeHtml(title)}</h2>
        <button class="icon-button" type="button" data-calendar-next aria-label="Следующий месяц">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      <div class="calendar__weekdays">
        ${WEEK_DAYS.map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="calendar__grid">
        ${days
          .map((date) => {
            if (!date) {
              return `<span class="calendar__blank"></span>`;
            }

            const iso = toIsoDate(date);
            const isStart = iso === startDate;
            const isEnd = iso === endDate;
            const isRange = isInRange(iso, startDate, endDate);
            const disabled = isPastDate(iso);

            return `
              <button
                class="calendar__day ${isStart ? "is-start" : ""} ${isEnd ? "is-end" : ""} ${isRange ? "is-range" : ""}"
                type="button"
                data-calendar-day="${escapeAttr(iso)}"
                ${disabled ? "disabled" : ""}
              >
                ${date.getDate()}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}
