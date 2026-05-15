import { authApi } from "./api/auth.js";
import { userApi } from "./api/user.js";
import { canUseLocalDebugAuth } from "./config.js";
import { withProfileCompletion } from "./profile.js";
import { appState, resetDomainState, setState } from "./state.js";
import {
  clearAuthStorage,
  getAccessToken,
  setAccessToken,
  setStoredClient,
} from "./storage.js";
import { getTelegramInitData } from "./telegram.js";

function isStaleStoredTokenError(error) {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  return error?.status === 401 || (error?.status === 404 && code === "user_not_found");
}

export async function bootstrapAuth() {
  const token = getAccessToken();
  if (token) {
    try {
      const user = withProfileCompletion(await userApi.me());
      setState({ accessToken: token, user });
      return user;
    } catch (error) {
      if (!isStaleStoredTokenError(error)) {
        throw error;
      }

      clearAuthStorage();
      resetDomainState();
      setState({ accessToken: null, authClient: null });
    }
  }

  const initData = getTelegramInitData();
  if (!initData && !canUseLocalDebugAuth()) {
    const error = new Error("Откройте приложение через Telegram");
    error.code = "telegram_init_data_required";
    throw error;
  }

  const authResponse = await authApi.telegram(initData || "{}");
  setAccessToken(authResponse.access_token);
  setStoredClient(authResponse.client);

  const user = withProfileCompletion(await userApi.me());
  setState({
    accessToken: authResponse.access_token,
    authClient: authResponse.client,
    user,
  });

  return user;
}

export function getCurrentUser() {
  return appState.user;
}

export function logout() {
  clearAuthStorage();
  resetDomainState();
  setState({ accessToken: null, authClient: null });
}
