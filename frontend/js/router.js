import { renderCarDetailPage } from "../pages/carDetail.js";
import { renderBookingPage } from "../pages/booking.js";
import { renderCarsPage } from "../pages/cars.js";
import { renderHistoryPage } from "../pages/history.js";
import { renderProfilePage } from "../pages/profile.js";
import { renderAdminPage } from "../pages/admin.js";
import { setTelegramBackButton } from "./telegram.js";

const routes = {
  cars: renderCarsPage,
  car: renderCarDetailPage,
  booking: renderBookingPage,
  history: renderHistoryPage,
  profile: renderProfilePage,
  admin: renderAdminPage,
};

const rootRoutes = new Set(["cars", "history", "profile", "admin"]);

let currentRoute = null;
let routeStack = [];
let ignoredHash = null;
let documentNavigationBound = false;

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  const [name, id] = parts;

  if (name === "car" && id) {
    return { name: "car", params: { carId: Number(id) } };
  }
  if (name === "booking" && id) {
    return { name: "booking", params: { carId: Number(id) } };
  }
  if (name === "history") {
    return { name: "history", params: {} };
  }
  if (name === "profile") {
    return { name: "profile", params: {} };
  }
  if (name === "admin") {
    return { name: "admin", params: { section: id || null } };
  }
  return { name: "cars", params: {} };
}

function hashFromRoute(route) {
  if (route.name === "car") {
    return `#/car/${route.params.carId}`;
  }
  if (route.name === "booking") {
    return `#/booking/${route.params.carId}`;
  }
  if (route.name === "history") {
    return "#/history";
  }
  if (route.name === "profile") {
    return "#/profile";
  }
  if (route.name === "admin") {
    return route.params?.section ? `#/admin/${route.params.section}` : "#/admin";
  }
  return "#/cars";
}

function canGoBack() {
  return routeStack.length > 0 || !rootRoutes.has(currentRoute?.name);
}

export async function renderCurrentRoute() {
  const page = routes[currentRoute.name] || routes.cars;
  await page({
    params: currentRoute.params,
    navigate,
    goBack,
  });

  setTelegramBackButton(canGoBack(), goBack);
}

export function navigate(name, params = {}, options = {}) {
  const nextRoute = { name, params };

  if (options.resetStack) {
    routeStack = [];
  } else if (currentRoute && !options.replace) {
    routeStack.push(currentRoute);
  }

  currentRoute = nextRoute;
  ignoredHash = hashFromRoute(currentRoute);
  window.location.hash = ignoredHash;
  renderCurrentRoute();
}

export function goBack() {
  if (routeStack.length > 0) {
    currentRoute = routeStack.pop();
  } else {
    currentRoute = { name: "cars", params: {} };
  }

  ignoredHash = hashFromRoute(currentRoute);
  window.location.hash = ignoredHash;
  renderCurrentRoute();
}

function bindDocumentNavigation() {
  if (documentNavigationBound) {
    return;
  }

  documentNavigationBound = true;

  document.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-nav]");
    if (navButton) {
      navigate(navButton.dataset.nav, {}, { resetStack: true });
      return;
    }

    const backButton = event.target.closest("[data-back]");
    if (backButton) {
      goBack();
    }
  });

  window.addEventListener("hashchange", () => {
    if (ignoredHash === window.location.hash) {
      ignoredHash = null;
      return;
    }

    currentRoute = routeFromHash();
    routeStack = [];
    renderCurrentRoute();
  });
}

export function startRouter() {
  if (!currentRoute) {
    currentRoute = routeFromHash();
  }

  if (!window.location.hash) {
    ignoredHash = hashFromRoute(currentRoute);
    window.location.hash = ignoredHash;
  }

  bindDocumentNavigation();
  return renderCurrentRoute();
}
