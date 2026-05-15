import { adminApi } from "../js/api/admin.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/feedback.js";
import { renderLayout } from "../components/layout.js";
import { statusBadge } from "../components/status.js";
import { showToast } from "../components/toast.js";
import { hasAdminAccess } from "../js/adminAccess.js";
import { ensureBranches, loadCarsForBranches } from "../js/dataLoaders.js";
import { appState } from "../js/state.js";
import {
  escapeAttr,
  escapeHtml,
  formatMoney,
  getApiError,
  hydrateIcons,
} from "../js/utils.js";

const CAR_STATUSES = ["available", "reserved", "rented", "maintenance"];

const adminState = {
  section: null,
  cars: [],
  branches: [],
  form: null,
  deleteTarget: null,
  saving: false,
  deleting: false,
};

let adminContext = null;

function adminErrorMessage(error) {
  const detail = error?.details?.detail;
  const detailCode = typeof detail === "string" ? detail : detail?.error_code;
  const code = String(error?.code || error?.error_code || error?.details?.error_code || detailCode || "").toUpperCase();
  const messages = {
    FORBIDDEN: "Недостаточно прав",
    CAR_HAS_ACTIVE_RENTALS: "Нельзя удалить автомобиль с активными бронированиями или арендой",
    BRANCH_HAS_CARS: "Нельзя удалить филиал, пока в нём есть автомобили",
    CAR_NOT_FOUND: "Автомобиль не найден",
    BRANCH_NOT_FOUND: "Филиал не найден",
  };
  if (error?.status === 403) {
    return messages.FORBIDDEN;
  }
  return messages[code] || "Не удалось выполнить действие";
}

function numberOrNull(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function renderSectionPicker() {
  return `
    <section class="admin-sections">
      <button class="admin-section-card" type="button" data-admin-section="cars">
        <i data-lucide="car-front"></i>
        <span>Машины</span>
      </button>
      <button class="admin-section-card" type="button" data-admin-section="branches">
        <i data-lucide="map-pinned"></i>
        <span>Филиалы</span>
      </button>
    </section>
  `;
}

function branchLabel(branchId) {
  const branch = adminState.branches.find((item) => Number(item.branch_id) === Number(branchId));
  return branch?.address || `branch_id: ${branchId}`;
}

function renderCarsSection() {
  return `
    <section class="admin-toolbar">
      <div>
        <p>Админ</p>
        <h2>Управление автомобилями</h2>
      </div>
      <button class="button button--primary" type="button" data-admin-add="car">
        <i data-lucide="plus"></i>
        <span>Добавить автомобиль</span>
      </button>
    </section>
    <section class="admin-list">
      ${
        adminState.cars.length
          ? adminState.cars.map(renderCarAdminItem).join("")
          : renderEmptyState("Автомобилей нет", "Добавьте первый автомобиль", "car-front")
      }
    </section>
    ${renderAdminFormModal()}
    ${renderDeleteModal()}
  `;
}

function renderCarAdminItem(car) {
  return `
    <article class="admin-item">
      <div class="admin-item__top">
        <div>
          <span>car_id: ${escapeHtml(car.car_id)}</span>
          <h3>${escapeHtml(car.model)}</h3>
        </div>
        ${statusBadge(car.status)}
      </div>
      <div class="admin-item__grid">
        <div><span>Год</span><strong>${escapeHtml(car.year)}</strong></div>
        <div><span>Цена</span><strong>${formatMoney(car.price_per_day)}</strong></div>
        <div><span>Филиал / ID</span><strong>${escapeHtml(`${branchLabel(car.branch_id)} (#${car.branch_id})`)}</strong></div>
        <div><span>image_url</span><strong>${escapeHtml(car.image_url || "Не указан")}</strong></div>
      </div>
      <div class="admin-item__actions">
        <button class="button button--secondary" type="button" data-admin-edit-car="${escapeAttr(car.car_id)}">
          <i data-lucide="pencil"></i>
          <span>Редактировать</span>
        </button>
        <button class="button button--danger" type="button" data-admin-delete-car="${escapeAttr(car.car_id)}">
          <i data-lucide="trash-2"></i>
          <span>Удалить</span>
        </button>
      </div>
    </article>
  `;
}

function renderBranchesSection() {
  return `
    <section class="admin-toolbar">
      <div>
        <p>Админ</p>
        <h2>Управление филиалами</h2>
      </div>
      <button class="button button--primary" type="button" data-admin-add="branch">
        <i data-lucide="plus"></i>
        <span>Добавить филиал</span>
      </button>
    </section>
    <section class="admin-list">
      ${
        adminState.branches.length
          ? adminState.branches.map(renderBranchAdminItem).join("")
          : renderEmptyState("Филиалов нет", "Добавьте первый филиал", "map-pin")
      }
    </section>
    ${renderAdminFormModal()}
    ${renderDeleteModal()}
  `;
}

function renderBranchAdminItem(branch) {
  return `
    <article class="admin-item">
      <div class="admin-item__top">
        <div>
          <span>branch_id: ${escapeHtml(branch.branch_id)}</span>
          <h3>${escapeHtml(branch.address)}</h3>
        </div>
      </div>
      <div class="admin-item__grid">
        <div><span>Вместимость</span><strong>${escapeHtml(branch.capacity)}</strong></div>
        <div><span>latitude</span><strong>${escapeHtml(branch.latitude ?? "Не указано")}</strong></div>
        <div><span>longitude</span><strong>${escapeHtml(branch.longitude ?? "Не указано")}</strong></div>
      </div>
      <div class="admin-item__actions">
        <button class="button button--secondary" type="button" data-admin-edit-branch="${escapeAttr(branch.branch_id)}">
          <i data-lucide="pencil"></i>
          <span>Редактировать</span>
        </button>
        <button class="button button--danger" type="button" data-admin-delete-branch="${escapeAttr(branch.branch_id)}">
          <i data-lucide="trash-2"></i>
          <span>Удалить</span>
        </button>
      </div>
    </article>
  `;
}

function renderCarFields(car = {}) {
  return `
    <label class="form-field">
      <span>model</span>
      <input type="text" name="model" required maxlength="50" value="${escapeAttr(car.model || "")}" />
    </label>
    <label class="form-field">
      <span>year</span>
      <input type="number" name="year" required min="1990" max="2100" value="${escapeAttr(car.year || "")}" />
    </label>
    <label class="form-field">
      <span>branch_id</span>
      <input type="number" name="branch_id" required min="1" value="${escapeAttr(car.branch_id || "")}" />
    </label>
    <label class="form-field">
      <span>price_per_day</span>
      <input type="number" name="price_per_day" required min="0" step="0.01" value="${escapeAttr(car.price_per_day || "")}" />
    </label>
    <label class="form-field">
      <span>status</span>
      <select name="status" required>
        ${CAR_STATUSES.map(
          (status) => `<option value="${status}" ${car.status === status ? "selected" : ""}>${status}</option>`,
        ).join("")}
      </select>
    </label>
    <label class="form-field">
      <span>image_url</span>
      <input type="text" name="image_url" placeholder="/assets/images/camry.jpg" value="${escapeAttr(car.image_url || "")}" />
    </label>
  `;
}

function renderBranchFields(branch = {}) {
  return `
    <label class="form-field">
      <span>address</span>
      <input type="text" name="address" required maxlength="255" value="${escapeAttr(branch.address || "")}" />
    </label>
    <label class="form-field">
      <span>capacity</span>
      <input type="number" name="capacity" required min="0" value="${escapeAttr(branch.capacity || "")}" />
    </label>
    <label class="form-field">
      <span>latitude</span>
      <input type="number" name="latitude" step="any" value="${escapeAttr(branch.latitude ?? "")}" />
    </label>
    <label class="form-field">
      <span>longitude</span>
      <input type="number" name="longitude" step="any" value="${escapeAttr(branch.longitude ?? "")}" />
    </label>
  `;
}

function renderAdminFormModal() {
  const form = adminState.form;
  if (!form) {
    return "";
  }

  const isCar = form.entity === "car";
  const title = `${form.mode === "create" ? "Добавить" : "Редактировать"} ${isCar ? "автомобиль" : "филиал"}`;

  return `
    <div class="modal-backdrop" data-admin-form-modal aria-hidden="false">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="admin-form-title">
        <div class="modal__header">
          <div>
            <p>Админ</p>
            <h2 id="admin-form-title">${escapeHtml(title)}</h2>
          </div>
          <button class="icon-button" type="button" data-admin-form-close aria-label="Закрыть">
            <i data-lucide="x"></i>
          </button>
        </div>
        <form class="profile-form" data-admin-form>
          ${isCar ? renderCarFields(form.item) : renderBranchFields(form.item)}
          <button class="button button--primary button--wide" type="submit" data-admin-save ${adminState.saving ? "disabled" : ""}>
            <i data-lucide="${adminState.saving ? "loader-circle" : "save"}"></i>
            <span>${adminState.saving ? "Сохраняем" : "Сохранить"}</span>
          </button>
        </form>
      </section>
    </div>
  `;
}

function renderDeleteModal() {
  const target = adminState.deleteTarget;
  if (!target) {
    return "";
  }

  const isCar = target.entity === "car";
  return `
    <div class="modal-backdrop" data-admin-delete-modal aria-hidden="false">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
        <div class="modal__header">
          <div>
            <p>Удаление</p>
            <h2 id="admin-delete-title">${isCar ? "Удалить автомобиль?" : "Удалить филиал?"}</h2>
          </div>
          <button class="icon-button" type="button" data-admin-delete-close aria-label="Закрыть">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal__body">
          <p>${escapeHtml(target.label)}</p>
          <div class="modal__actions">
            <button class="button button--secondary" type="button" data-admin-delete-close>
              <span>Отмена</span>
            </button>
            <button class="button button--danger" type="button" data-admin-delete-confirm ${adminState.deleting ? "disabled" : ""}>
              <i data-lucide="${adminState.deleting ? "loader-circle" : "trash-2"}"></i>
              <span>${adminState.deleting ? "Удаляем" : "Удалить"}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAdminContent() {
  if (!hasAdminAccess(appState.user)) {
    return renderEmptyState("Недостаточно прав", "Админ-панель доступна только сотрудникам", "shield-alert");
  }

  if (!adminState.section) {
    return renderSectionPicker();
  }

  return adminState.section === "branches" ? renderBranchesSection() : renderCarsSection();
}

function renderAdminReady() {
  renderLayout({
    title: "Админ",
    subtitle: "Управление данными",
    activeTab: "admin",
    content: renderAdminContent(),
  });
  bindAdminEvents();
}

async function loadAdminData(section) {
  adminState.branches = await ensureBranches(section === "branches");
  if (section === "cars") {
    adminState.cars = await loadCarsForBranches([]);
    adminState.branches = appState.branches;
  }
}

function openForm(entity, mode, item = {}) {
  adminState.form = { entity, mode, item };
  renderAdminReady();
}

function closeForm() {
  if (adminState.saving) {
    return;
  }
  adminState.form = null;
  renderAdminReady();
}

function openDelete(entity, item) {
  adminState.deleteTarget = {
    entity,
    id: entity === "car" ? item.car_id : item.branch_id,
    label: entity === "car" ? item.model : item.address,
  };
  renderAdminReady();
}

function closeDelete() {
  if (adminState.deleting) {
    return;
  }
  adminState.deleteTarget = null;
  renderAdminReady();
}

function carPayload(form) {
  const formData = new FormData(form);
  const imageUrl = String(formData.get("image_url") || "").trim();
  return {
    model: String(formData.get("model") || "").trim(),
    year: Number(formData.get("year")),
    branch_id: Number(formData.get("branch_id")),
    price_per_day: Number(formData.get("price_per_day")),
    status: String(formData.get("status") || ""),
    image_url: imageUrl || null,
  };
}

function branchPayload(form) {
  const formData = new FormData(form);
  return {
    address: String(formData.get("address") || "").trim(),
    capacity: Number(formData.get("capacity")),
    latitude: numberOrNull(formData.get("latitude")),
    longitude: numberOrNull(formData.get("longitude")),
  };
}

async function reloadCurrentSection() {
  await loadAdminData(adminState.section);
  renderAdminReady();
}

async function saveAdminForm(formElement) {
  if (adminState.saving || !adminState.form) {
    return;
  }

  const currentForm = adminState.form;
  const payload = currentForm.entity === "car" ? carPayload(formElement) : branchPayload(formElement);

  adminState.saving = true;
  adminState.form = {
    ...currentForm,
    item: {
      ...currentForm.item,
      ...payload,
    },
  };
  renderAdminReady();

  try {
    if (currentForm.entity === "car") {
      if (currentForm.mode === "create") {
        await adminApi.createCar(payload);
      } else {
        await adminApi.updateCar(currentForm.item.car_id, payload);
      }
    } else {
      if (currentForm.mode === "create") {
        await adminApi.createBranch(payload);
      } else {
        await adminApi.updateBranch(currentForm.item.branch_id, payload);
      }
    }

    adminState.form = null;
    adminState.saving = false;
    showToast("Изменения сохранены", "success");
    await reloadCurrentSection();
  } catch (error) {
    showToast(adminErrorMessage(error), "error");
    adminState.saving = false;
    renderAdminReady();
  }
}

async function confirmDelete() {
  if (adminState.deleting || !adminState.deleteTarget) {
    return;
  }

  const target = adminState.deleteTarget;

  adminState.deleting = true;
  renderAdminReady();

  try {
    if (target.entity === "car") {
      await adminApi.deleteCar(target.id);
    } else {
      await adminApi.deleteBranch(target.id);
    }

    adminState.deleteTarget = null;
    adminState.deleting = false;
    showToast("Удалено", "success");
    await reloadCurrentSection();
  } catch (error) {
    showToast(adminErrorMessage(error), "error");
    adminState.deleting = false;
    renderAdminReady();
  }
}

function bindAdminEvents() {
  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.adminSection;
      if (adminContext?.navigate) {
        adminContext.navigate("admin", { section }, { replace: true });
      } else {
        window.location.hash = `#/admin/${section}`;
      }
    });
  });

  document.querySelector("[data-admin-add='car']")?.addEventListener("click", () => openForm("car", "create"));
  document.querySelector("[data-admin-add='branch']")?.addEventListener("click", () => openForm("branch", "create"));

  document.querySelectorAll("[data-admin-edit-car]").forEach((button) => {
    button.addEventListener("click", () => {
      const car = adminState.cars.find((item) => Number(item.car_id) === Number(button.dataset.adminEditCar));
      if (car) {
        openForm("car", "edit", car);
      }
    });
  });

  document.querySelectorAll("[data-admin-edit-branch]").forEach((button) => {
    button.addEventListener("click", () => {
      const branch = adminState.branches.find((item) => Number(item.branch_id) === Number(button.dataset.adminEditBranch));
      if (branch) {
        openForm("branch", "edit", branch);
      }
    });
  });

  document.querySelectorAll("[data-admin-delete-car]").forEach((button) => {
    button.addEventListener("click", () => {
      const car = adminState.cars.find((item) => Number(item.car_id) === Number(button.dataset.adminDeleteCar));
      if (car) {
        openDelete("car", car);
      }
    });
  });

  document.querySelectorAll("[data-admin-delete-branch]").forEach((button) => {
    button.addEventListener("click", () => {
      const branch = adminState.branches.find((item) => Number(item.branch_id) === Number(button.dataset.adminDeleteBranch));
      if (branch) {
        openDelete("branch", branch);
      }
    });
  });

  document.querySelector("[data-admin-form-close]")?.addEventListener("click", closeForm);
  document.querySelector("[data-admin-form-modal]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeForm();
    }
  });
  document.querySelector("[data-admin-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAdminForm(event.currentTarget);
  });

  document.querySelectorAll("[data-admin-delete-close]").forEach((button) => {
    button.addEventListener("click", closeDelete);
  });
  document.querySelector("[data-admin-delete-modal]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeDelete();
    }
  });
  document.querySelector("[data-admin-delete-confirm]")?.addEventListener("click", confirmDelete);

  hydrateIcons();
}

export async function renderAdminPage(ctx) {
  adminContext = ctx;

  if (!hasAdminAccess(appState.user)) {
    renderAdminReady();
    return;
  }

  const section = ctx.params?.section;
  adminState.section = section === "cars" || section === "branches" ? section : null;
  adminState.form = null;
  adminState.deleteTarget = null;
  adminState.saving = false;
  adminState.deleting = false;

  if (!adminState.section) {
    renderAdminReady();
    return;
  }

  renderLayout({
    title: "Админ",
    subtitle: "Управление данными",
    activeTab: "admin",
    content: renderLoadingState("Загружаем админ-панель", "Получаем данные"),
  });

  try {
    await loadAdminData(adminState.section);
    renderAdminReady();
  } catch (error) {
    const apiError = getApiError(error, "Не удалось загрузить админ-панель");
    renderLayout({
      title: "Админ",
      activeTab: "admin",
      content: renderErrorState("Админ-панель недоступна", adminErrorMessage(error) || apiError.message),
    });
    document.querySelector("[data-retry]")?.addEventListener("click", () => renderAdminPage(ctx));
  }
}
