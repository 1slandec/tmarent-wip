import { branchesApi } from "./api/branches.js";
import { carsApi } from "./api/cars.js";
import { appState, setState } from "./state.js";

const carsLoadsInFlight = new Map();

export async function ensureBranches(force = false) {
  if (!force && appState.branches.length > 0) {
    return appState.branches;
  }

  const branches = await branchesApi.list();
  setState({ branches });
  return branches;
}

export async function loadCarsForBranch(branchId) {
  const branch = appState.branches.find((item) => Number(item.branch_id) === Number(branchId));
  const cars = (await carsApi.list(branchId)).map((car) => ({
    ...car,
    branch,
  }));

  setState({
    cars,
    selectedBranchId: Number(branchId),
    selectedBranchIds: [Number(branchId)],
  });

  return cars;
}

export async function loadCarsForBranches(branchIds = []) {
  const normalizedIds = [...new Set(branchIds.map(Number).filter(Boolean))].sort((a, b) => a - b);
  const loadKey = normalizedIds.length ? normalizedIds.join(",") : "all";

  if (carsLoadsInFlight.has(loadKey)) {
    return carsLoadsInFlight.get(loadKey);
  }

  const loadPromise = (async () => {
    const branchesToLoad = normalizedIds.length
      ? appState.branches.filter((branch) => normalizedIds.includes(Number(branch.branch_id)))
      : appState.branches;

    const carsByBranch = await Promise.all(
      branchesToLoad.map(async (branch) => {
        const cars = await carsApi.list(branch.branch_id);
        return cars.map((car) => ({
          ...car,
          branch,
        }));
      }),
    );

    const cars = carsByBranch.flat();

    setState({
      cars,
      selectedBranchId: normalizedIds[0] || null,
      selectedBranchIds: normalizedIds,
    });

    return cars;
  })();

  carsLoadsInFlight.set(loadKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    if (carsLoadsInFlight.get(loadKey) === loadPromise) {
      carsLoadsInFlight.delete(loadKey);
    }
  }
}

export async function findCarWithBranch(carId) {
  const cached = appState.cars.find((car) => Number(car.car_id) === Number(carId));
  if (cached) {
    return cached;
  }

  const branches = await ensureBranches();
  for (const branch of branches) {
    const cars = (await carsApi.list(branch.branch_id)).map((car) => ({
      ...car,
      branch,
    }));
    const match = cars.find((car) => Number(car.car_id) === Number(carId));
    if (match) {
      setState({
        cars,
        selectedBranchId: Number(branch.branch_id),
        selectedBranchIds: [Number(branch.branch_id)],
      });
      return match;
    }
  }

  return null;
}
