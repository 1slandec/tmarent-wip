import { APP_CONFIG } from "./config.js";

export function getAccessToken() {
  return localStorage.getItem(APP_CONFIG.tokenStorageKey);
}

export function setAccessToken(token) {
  localStorage.setItem(APP_CONFIG.tokenStorageKey, token);
}

export function clearAccessToken() {
  localStorage.removeItem(APP_CONFIG.tokenStorageKey);
}

export function getStoredClient() {
  const value = localStorage.getItem(APP_CONFIG.clientStorageKey);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function setStoredClient(client) {
  localStorage.setItem(APP_CONFIG.clientStorageKey, JSON.stringify(client));
}

export function clearStoredClient() {
  localStorage.removeItem(APP_CONFIG.clientStorageKey);
}

export function clearAuthStorage() {
  clearAccessToken();
  clearStoredClient();
}
