import { renderCarCard } from "../components/carCard.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { showToast } from "../components/toast.js";
import { ensureBranches, loadCarsForBranches } from "../js/dataLoaders.js";
import { appState } from "../js/state.js";
import { escapeAttr, escapeHtml, getApiError, hydrateIcons } from "../js/utils.js";

let searchQuery = "";
let isFilterOpen = false;

function isAllBranchesSelected(selectedBranchIds) {
  return !selectedBranchIds.length;
}

function branchTitle(branches, selectedBranchIds) {
  if (isAllBranchesSelected(selectedBranchIds)) {
    return "Все филиалы";
  }

  if (selectedBranchIds.length === 1) {
    const branch = branches.find((item) => Number(item.branch_id) === Number(selectedBranchIds[0]));
    return branch?.address || "Один филиал";
  }

  return `${selectedBranchIds.length} филиала выбрано`;
}

function renderBranchMenu(branches, selectedBranchIds) {
  const allSelected = isAllBranchesSelected(selectedBranchIds);

  return `
    <div class="branch-menu ${isFilterOpen ? "is-open" : ""}">
      <button class="branch-menu__item branch-menu__item--all ${allSelected ? "is-active" : ""}" type="button" data-branch-all>
        <span>Все филиалы</span>
        <small>${allSelected ? "Выбраны" : "Сбросить"}</small>
      </button>
      ${branches
        .map((branch) => {
          const isActive = selectedBranchIds.includes(Number(branch.branch_id));
          return `
            <button class="branch-menu__item ${isActive ? "is-active" : ""}" type="button" data-branch-id="${escapeAttr(branch.branch_id)}">
              <span>${escapeHtml(branch.address)}</span>
              <small>${isActive ? "Выбран" : `${escapeHtml(branch.capacity)} мест`}</small>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function filterCars(cars) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return cars;
  }

  return cars.filter((car) => car.model.toLowerCase().includes(query));
}

function renderCarsContent(branches, cars, selectedBranchIds) {
  const filteredCars = filterCars(cars);

  return `
    <section class="cars-hero">
      <div>
        <p>Филиалы</p>
        <h2>${escapeHtml(branchTitle(branches, selectedBranchIds))}</h2>
      </div>
      <span>${filteredCars.length}</span>
    </section>

    <section class="toolbar">
      <label class="search-field">
        <i data-lucide="search"></i>
        <input type="search" placeholder="Поиск по названию" value="${escapeAttr(searchQuery)}" data-car-search />
      </label>
      <button class="icon-button icon-button--accent ${isFilterOpen ? "is-active" : ""}" type="button" data-filter-toggle aria-label="Фильтр">
        <i data-lucide="sliders-horizontal"></i>
      </button>
    </section>

    ${renderBranchMenu(branches, selectedBranchIds)}

    <section class="cars-list" id="cars-list">
      ${
        filteredCars.length
          ? filteredCars.map((car) => renderCarCard(car, car.branch)).join("")
          : renderEmptyState("Авто не найдены", "Попробуйте изменить поиск или выбрать другой филиал", "car-front")
      }
    </section>
  `;
}

function nextBranchSelection(selectedBranchIds, branchId) {
  if (isAllBranchesSelected(selectedBranchIds)) {
    return [branchId];
  }

  if (selectedBranchIds.includes(branchId)) {
    return selectedBranchIds.filter((id) => id !== branchId);
  }

  return [...selectedBranchIds, branchId];
}

function bindCarsEvents(ctx, branches, cars, selectedBranchIds) {
  const searchInput = document.querySelector("[data-car-search]");
  searchInput?.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    const list = document.querySelector("#cars-list");
    if (!list) {
      return;
    }

    const filteredCars = filterCars(cars);
    list.innerHTML = filteredCars.length
      ? filteredCars.map((car) => renderCarCard(car, car.branch)).join("")
      : renderEmptyState("Авто не найдены", "Попробуйте изменить поиск или выбрать другой филиал", "car-front");
    hydrateIcons();
  });

  document.querySelector("[data-filter-toggle]")?.addEventListener("click", () => {
    isFilterOpen = !isFilterOpen;
    renderLayout({
      title: "Авто",
      subtitle: "Выберите машину и даты аренды",
      activeTab: "cars",
      content: renderCarsContent(branches, cars, selectedBranchIds),
    });
    bindCarsEvents(ctx, branches, cars, selectedBranchIds);
  });

  document.querySelector("[data-branch-all]")?.addEventListener("click", async () => {
    await renderCarsPage(ctx, []);
  });

  document.querySelectorAll("[data-branch-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const branchId = Number(button.dataset.branchId);
      const nextSelection = nextBranchSelection(selectedBranchIds, branchId);
      await renderCarsPage(ctx, nextSelection);
    });
  });

  document.querySelectorAll("[data-open-car]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      ctx.navigate("car", {
        carId: Number(element.dataset.openCar),
      });
    });
  });
}

export async function renderCarsPage(ctx, forcedBranchIds = null) {
  renderLayout({
    title: "Авто",
    subtitle: "Выберите машину и даты аренды",
    activeTab: "cars",
    content: renderLoadingState("Ищем автомобили", "Загружаем филиалы и свободные машины"),
  });

  try {
    const branches = await ensureBranches();
    if (!branches.length) {
      renderLayout({
        title: "Авто",
        activeTab: "cars",
        content: renderEmptyState("Филиалов пока нет", "Список филиалов пуст", "map-pin-off"),
      });
      return;
    }

    const selectedBranchIds = Array.isArray(forcedBranchIds)
      ? forcedBranchIds
      : appState.selectedBranchIds || [];
    const cars = await loadCarsForBranches(selectedBranchIds);

    renderLayout({
      title: "Авто",
      subtitle: "Выберите машину и даты аренды",
      activeTab: "cars",
      content: renderCarsContent(branches, cars, selectedBranchIds),
    });
    bindCarsEvents(ctx, branches, cars, selectedBranchIds);
  } catch (error) {
    const apiError = getApiError(error, "Не удалось загрузить автомобили");
    renderLayout({
      title: "Авто",
      activeTab: "cars",
      content: renderErrorState("Не загрузили авто", apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderCarsPage(ctx));
    showToast(apiError.message, "error");
  }
}
