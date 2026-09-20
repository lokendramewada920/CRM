import axios from "axios";
import { API_URL } from "./config";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("aof_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("aof_token");
      localStorage.removeItem("aof_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);
