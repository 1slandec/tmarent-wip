import { APP_CONFIG } from "../config.js";
import { clearAuthStorage, getAccessToken } from "../storage.js";

function createHttpClient() {
  if (!window.axios?.create) {
    throw new Error("Axios не загружен");
  }

  const client = window.axios.create({
    baseURL: APP_CONFIG.apiBaseUrl,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const data = error.response?.data || {};
      const normalized = new Error(data.message || error.message || "Request failed");
      normalized.code = data.error_code || error.code || "request_failed";
      normalized.status = error.response?.status || 0;
      normalized.details = data;

      if (normalized.status === 401) {
        clearAuthStorage();
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }

      return Promise.reject(normalized);
    },
  );

  return client;
}

export const http = createHttpClient();
