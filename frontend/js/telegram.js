export function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

export function initTelegram() {
  const tg = getTelegramWebApp();
  if (!tg) {
    return null;
  }

  tg.ready();
  tg.expand();

  if (!tg.isVersionAtLeast || tg.isVersionAtLeast("6.1")) {
    tg.setHeaderColor("#0E1416");
    tg.setBackgroundColor("#0E1416");
  }

  return tg;
}

export function getTelegramInitData() {
  return getTelegramWebApp()?.initData || "";
}

export function setTelegramBackButton(isVisible, onClick) {
  const backButton = getTelegramWebApp()?.BackButton;
  if (!backButton) {
    return;
  }

  backButton.offClick(onClick);
  if (isVisible) {
    backButton.onClick(onClick);
    backButton.show();
  } else {
    backButton.hide();
  }
}

export function haptic(type = "selection") {
  const feedback = getTelegramWebApp()?.HapticFeedback;
  if (!feedback) {
    return;
  }

  if (type === "success" || type === "error" || type === "warning") {
    feedback.notificationOccurred(type);
    return;
  }

  feedback.selectionChanged();
}
