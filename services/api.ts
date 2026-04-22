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
const MACHINE_IP = "192.168.1.3";
const BACKEND_PORT = "4000";

const WEB_URL = `http://localhost:${BACKEND_PORT}/api`;
const PROD_URL = "https://api.bharatproperties.co/api";
const TUNNEL_URL = "https://bharat-crm-stable-api.loca.lt/api";
const LAN_URL = `http://${MACHINE_IP}:${BACKEND_PORT}/api`;

const NATIVE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || TUNNEL_URL;

const BASE_URL = Platform.OS === "web" ? WEB_URL : NATIVE_URL;

console.log(`[API] Configuration Found:`);
console.log(`- Platform: ${Platform.OS}`);
console.log(`- Base URL: ${BASE_URL}`);
console.log(`- Local IP: ${LAN_URL}`);
console.log(`- Tunnel URL: ${TUNNEL_URL}`);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Bypass-Tunnel-Reminder": "true",
  },
});

// Configure Exponential Backoff Retries
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on Network Error or 5xx status codes
    return error.code === 'ECONNABORTED' || (!error.response && error.request) || (error.response?.status && error.response.status >= 500);
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

// --- Silent Token Refresh Implementation ---
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
};

let on401Callback: (() => void) | null = null;

export const set401Callback = (callback: () => void) => {
  on401Callback = callback;
};

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
    console.warn(`[API] ❌ ${status || "NO_RESPONSE"} ${url} — ${msg}`);

    if (status === 401 && !error.config._retry) {
      // 1. If the refresh call itself fails, we must logout
      if (url.includes('/auth/refresh')) {
        console.warn('[API] Refresh token expired. Force logout.');
        await storage.deleteItem("authToken");
        await storage.deleteItem("refreshToken");
        if (on401Callback) on401Callback();
        return Promise.reject(error);
      }

      // 2. Queue simultaneous requests while refreshing
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken) => {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(error.config));
          });
        });
      }

      // 3. Start refresh process
      error.config._retry = true;
      isRefreshing = true;

      try {
        const savedRefreshToken = await storage.getItem('refreshToken');
        if (!savedRefreshToken) {
          // Explicitly handle standard session expiry without a scary error
          console.warn('[API] Session expired (No refresh token). Redirecting to login.');
          throw new Error('SESSION_EXPIRED');
        }

        console.log('[API] Attempting silent token refresh...');
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: savedRefreshToken
        }, {
          headers: { "Content-Type": "application/json" }
        });

        if (res.data.success && res.data.token) {
          const newToken = res.data.token;
          const newRefreshToken = res.data.refreshToken;
          
          await storage.setItem('authToken', newToken);
          if (newRefreshToken) await storage.setItem('refreshToken', newRefreshToken);
          
          isRefreshing = false;
          onRefreshed(newToken);

          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api(error.config);
        }
      } catch (refreshErr) {
        isRefreshing = false;
        
        const isExpired = refreshErr.message === 'SESSION_EXPIRED' || refreshErr.message.includes('expired');
        if (isExpired) {
            console.warn('[API] Silent refresh skipped: Session is invalid or expired.');
        } else {
            console.error('[API] Refresh request failed:', refreshErr.message);
        }
        
        // Final fallback: real logout
        const isPublicRoute = url.includes('/public/') || url.includes('/health') || url.includes('/sms-gateway/status');
        if (!isPublicRoute) {
          await storage.deleteItem("authToken");
          await storage.deleteItem("refreshToken");
          if (on401Callback) on401Callback();
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;