import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
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
