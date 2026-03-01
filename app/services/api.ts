import axios from "axios";
import { Platform } from "react-native";
import { storage } from "./storage";
import axiosRetry from "axios-retry";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================
// API BASE URL CONFIGURATION
// On Web: localhost (same machine as backend)
// On Native (Expo Go on phone): use the Mac's LAN IP
// The env var EXPO_PUBLIC_API_BASE_URL can override this.
// ============================================================
const MACHINE_IP = "192.168.1.10";
const BACKEND_PORT = "4000";

const WEB_URL = `http://localhost:${BACKEND_PORT}/api`;
const NATIVE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || `https://bharat-crm-stable-api.loca.lt/api`;

const BASE_URL = Platform.OS === "web" ? WEB_URL : NATIVE_URL;

console.log(`[API] Platform: ${Platform.OS} | Base URL: ${BASE_URL}`);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Origin": "https://crm.bharatproperties.com",
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// Configure Exponential Backoff Retries
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on Network Error or 5xx status codes
    return error.code === 'ECONNABORTED' || (!error.response && error.request) || (error.response?.status >= 500);
  }
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

// --- Response Interceptor: Offline Caching & Handle 401 ---
api.interceptors.response.use(
  async (response) => {
    console.log(`[API] ✅ ${response.status} ${response.config.url}`);

    // Cache successful GET requests for offline fallback
    if (response.config.method?.toUpperCase() === 'GET' && response.data) {
      try {
        const cacheKey = `@offline_cache_${response.config.url}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
      } catch (err) {
        console.warn(`[API] Failed to cache data for ${response.config.url}`);
      }
    }

    return response;
  },
  async (error) => {
    const isNetworkError = !error.response && error.request;
    const isTimeout = error.code === 'ECONNABORTED';

    // Offline Fallback for GET Requests
    if ((isNetworkError || isTimeout) && error.config?.method?.toUpperCase() === 'GET') {
      try {
        const cacheKey = `@offline_cache_${error.config.url}`;
        const cachedPayload = await AsyncStorage.getItem(cacheKey);
        if (cachedPayload) {
          console.log(`[API] 📴 Network failure. Serving offline cache for ${error.config.url}`);
          // Return simulated successful response containing cached static data
          return Promise.resolve({
            data: JSON.parse(cachedPayload),
            status: 200,
            statusText: 'OK (Offline Cache)',
            headers: {},
            config: error.config,
            isOfflineVal: true
          });
        }
      } catch (err) {
        console.warn(`[API] Cache retrieval failed for ${error.config.url}`);
      }
    }

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