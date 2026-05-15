export const APP_CONFIG = {
  apiBaseUrl:
    window.__APP_CONFIG__?.API_BASE_URL ||
    localStorage.getItem("API_BASE_URL") ||
    "https://tmarent-wip.onrender.com",
  tokenStorageKey: "tmarent.access_token",
  clientStorageKey: "tmarent.client",
};

export function canUseLocalDebugAuth() {
  return (
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}
