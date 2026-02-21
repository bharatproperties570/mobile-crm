import axios from "axios";
import { Platform } from "react-native";
import { storage } from "./storage";

// ============================================================
// API BASE URL CONFIGURATION
// On Web: localhost (same machine as backend)
// On Native (Expo Go on phone): use the Mac's LAN IP
// The env var EXPO_PUBLIC_API_BASE_URL can override this.
// ============================================================
const MACHINE_IP = "192.168.1.10";
const BACKEND_PORT = "4000";

const WEB_URL = `http://localhost:${BACKEND_PORT}/api`;
const NATIVE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${MACHINE_IP}:${BACKEND_PORT}/api`;

const BASE_URL = Platform.OS === "web" ? WEB_URL : NATIVE_URL;

console.log(`[API] Platform: ${Platform.OS} | Base URL: ${BASE_URL}`);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// --- Request Interceptor: attach JWT token ---
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) { }
    console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor: handle 401 ---
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ✅ ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const msg = error?.response?.data?.message || error?.message || "Unknown error";
    console.error(`[API] ❌ ${status || "NO_RESPONSE"} ${url} — ${msg}`);

    if (status === 401) {
      await storage.deleteItem("authToken").catch(() => { });
    }
    return Promise.reject(error);
  }
);

export default api;