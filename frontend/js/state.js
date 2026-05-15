import { getAccessToken, getStoredClient } from "./storage.js";

export const appState = {
  accessToken: getAccessToken(),
  authClient: getStoredClient(),
  user: null,
  branches: [],
  cars: [],
  selectedBranchId: null,
  selectedBranchIds: [],
  activeBooking: null,
  agreementHistory: [],
};

export function setState(patch) {
  Object.assign(appState, patch);
}

export function resetDomainState() {
  setState({
    user: null,
    branches: [],
    cars: [],
    selectedBranchId: null,
    selectedBranchIds: [],
    activeBooking: null,
    agreementHistory: [],
  });
}
