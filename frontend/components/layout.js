import { escapeHtml, hydrateIcons } from "../js/utils.js";
import { hasAdminAccess } from "../js/adminAccess.js";
import { appState } from "../js/state.js";

function navItem(route, icon, label, activeTab) {
  const isActive = activeTab === route;
  return `
    <button class="bottom-nav__item ${isActive ? "is-active" : ""}" type="button" data-nav="${route}">
      <i data-lucide="${icon}"></i>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

export function renderLayout({
  title,
  subtitle = "",
  content,
  activeTab = "cars",
  showBack = false,
  chrome = true,
}) {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <div class="app-shell ${chrome ? "" : "app-shell--plain"}">
      ${
        chrome
          ? `
            <header class="topbar">
              <button class="icon-button topbar__back ${showBack ? "" : "is-hidden"}" type="button" data-back aria-label="Назад">
                <i data-lucide="chevron-left"></i>
              </button>
              <div class="topbar__copy">
                <p class="topbar__eyebrow">TMARent</p>
                <h1>${escapeHtml(title)}</h1>
                ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
              </div>
            </header>
          `
          : ""
      }
      <main class="screen-content">${content}</main>
      ${
        chrome
          ? `
            <nav class="bottom-nav" aria-label="Основная навигация">
              ${navItem("cars", "car-front", "Авто", activeTab)}
              ${navItem("history", "clipboard-list", "История", activeTab)}
              ${navItem("profile", "user-round", "Профиль", activeTab)}
              ${hasAdminAccess(appState.user) ? navItem("admin", "shield-check", "Админ", activeTab) : ""}
            </nav>
          `
          : ""
      }
    </div>
  `;

  hydrateIcons();
}
