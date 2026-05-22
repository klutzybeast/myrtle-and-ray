import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const api = axios.create({
  baseURL: API,
});

// attach access token from localStorage as a fallback for cross-site cookie blocking
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("mr_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export function setToken(token) {
  if (token) localStorage.setItem("mr_token", token);
  else localStorage.removeItem("mr_token");
}

/**
 * Extract a human-readable error message from any axios error.
 * Critical: FastAPI's 422 returns `detail` as an Array<{msg, loc, ...}> —
 * rendering that array directly in JSX crashes React. Always pipe API
 * errors through this helper before putting them in a toast or state.
 */
export function extractErrMsg(err, fallback = "Something went wrong.") {
  const d = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const parts = d.map((e) => (e && typeof e === "object" ? (e.msg || e.message || JSON.stringify(e)) : String(e)));
    return parts.filter(Boolean).join(", ") || fallback;
  }
  if (typeof d === "object") return d.msg || d.message || d.detail || fallback;
  return String(d) || fallback;
}
