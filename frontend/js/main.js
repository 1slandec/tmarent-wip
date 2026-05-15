import { bootstrapAuth } from "./auth.js";
import { renderLayout } from "../components/layout.js";
import { renderErrorState, renderLoadingState } from "../components/feedback.js";
import { showToast } from "../components/toast.js";
import { startRouter } from "./router.js";
import { initTelegram } from "./telegram.js";
import { getApiError } from "./utils.js";

let appStartPromise = null;
let appStarted = false;

async function startApp(options = {}) {
  const { force = false, silent = false } = options;

  if (appStartPromise) {
    return appStartPromise;
  }

  if (appStarted && !force) {
    return Promise.resolve();
  }

  appStartPromise = runAppStart({ silent }).finally(() => {
    appStartPromise = null;
  });

  return appStartPromise;
}

async function runAppStart({ silent }) {
  initTelegram();

  if (!silent) {
    renderLayout({
      chrome: false,
      content: renderLoadingState("Запускаем TMARent", "Подключаем Telegram и backend"),
    });
  }

  try {
    await bootstrapAuth();
    await startRouter();
    appStarted = true;
  } catch (error) {
    appStarted = false;
    const apiError = getApiError(error, "Не удалось авторизоваться");
    renderLayout({
      chrome: false,
      content: renderErrorState("Авторизация недоступна", apiError.message, "Попробовать снова"),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => startApp({ force: true }));
  }
}

window.addEventListener("auth:expired", () => {
  if (appStartPromise) {
    return;
  }

  showToast("Сессия истекла. Авторизуемся заново", "error");
  startApp({ force: true, silent: false });
});

startApp();
