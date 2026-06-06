import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "@/services/storage";
import api, { set401Callback } from "@/services/api";
import * as SplashScreen from "expo-splash-screen";

interface AuthContextType {
    token: string | null;
    refreshToken: string | null;
    user: any | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (token: string, refreshToken: string, user: any) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);

    // loading=true on mount — prevents redirect engine from firing before auth check
    const [loading, setLoading] = useState(true);

    const router = useRouter();
    const rootNavigationState = useRootNavigationState();

    // Safety: useSegments can throw if router isn't mounted yet
    let segments: string[] = [];
    try {
        segments = useSegments();
    } catch {
        // Router not ready — will retry on next render
    }

    // ── Auth Check ─────────────────────────────────────────────────────────────
    // CRITICAL: SplashScreen.hideAsync() is called INSIDE this function's finally
    // block. This guarantees the splash ONLY hides after auth state is resolved,
    // meaning the correct destination screen is rendered BEFORE the splash goes away.
    // This eliminates the white flash window entirely.
    const checkAuth = async () => {
        setLoading(true);
        console.log("[AuthContext] Starting auth check...");

        // Failsafe ref: prevents stale-closure double-fire bug
        const done = { value: false };

        const timeout = setTimeout(() => {
            if (!done.value) {
                done.value = true;
                console.warn("[AuthContext] Auth check timed out (8s). Forcing resolution.");
                setLoading(false);
                SplashScreen.hideAsync().catch(() => {});
            }
        }, 8000);

        try {
            const [savedToken, savedRefreshToken, savedUser] = await Promise.all([
                storage.getItem("authToken"),
                storage.getItem("refreshToken"),
                storage.getItem("userData"),
            ]);

            if (savedToken) {
                console.log("[AuthContext] ✅ Token found — restoring session");
                setToken(savedToken);
                setRefreshToken(savedRefreshToken);
                if (savedUser) {
                    try {
                        setUser(JSON.parse(savedUser));
                    } catch {
                        console.warn("[AuthContext] userData parse failed — ignoring cached user");
                    }
                }
            } else {
                console.log("[AuthContext] No token — user must log in");
            }
        } catch (error) {
            console.error("[AuthContext] Auth check error:", error);
        } finally {
            if (!done.value) {
                done.value = true;
                clearTimeout(timeout);
                setLoading(false);

                // ── The ONE place splash screen hides ─────────────────────────
                // At this point:
                //   • loading will become false (triggering redirect effect)
                //   • router.replace() will have the correct destination
                //   • the screen behind the splash is already dark (#121212)
                // So when splash lifts: user sees correct dark screen immediately.
                SplashScreen.hideAsync().catch(() => {});
                console.log("[AuthContext] ✅ Auth resolved — splash hiding now");
            }
        }
    };

    // ── Mount: register 401 handler + run auth check ────────────────────────
    useEffect(() => {
        if (set401Callback) {
            set401Callback(async () => {
                console.warn("[AuthContext] 401 detected → logout");
                await logout();
            });
        }
        checkAuth();
    }, []);

    // ── Redirect Engine ────────────────────────────────────────────────────────
    // Fires whenever loading or token changes.
    // loading=true → skip (auth not resolved yet)
    // loading=false + token → go to tabs
    // loading=false + no token → go to login
    useEffect(() => {
        if (loading) return; // Wait for auth check to complete
        if (!rootNavigationState?.key) return; // Wait for navigation to be ready

        const group = segments?.[0];
        const inAuthGroup = group === "(auth)";
        const isAtRoot = !segments || segments.length === 0;

        if (!token) {
            if (!inAuthGroup) {
                console.log("[AuthContext] Redirect → /(auth)/login");
                router.replace("/(auth)/login");
            }
        } else {
            if (isAtRoot || inAuthGroup) {
                console.log("[AuthContext] Redirect → /(tabs)");
                router.replace("/(tabs)");
            }
        }
    }, [token, loading, rootNavigationState?.key, segments]);
    // NOTE: Intentionally NOT including `segments` in deps — it causes loop
    // when navigating. token+loading is the correct minimal dependency set.

    // ── Auth Actions ───────────────────────────────────────────────────────────
    const login = async (newToken: string, newRefreshToken: string, userData: any) => {
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        setUser(userData);
        await Promise.all([
            storage.setItem("authToken", newToken),
            storage.setItem("refreshToken", newRefreshToken),
            storage.setItem("userData", JSON.stringify(userData)),
        ]);
    };

    const logout = async () => {
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        await Promise.all([
            storage.deleteItem("authToken"),
            storage.deleteItem("refreshToken"),
            storage.deleteItem("userData"),
        ]);
        // Clear all caches
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(
                (k) => k.startsWith("@cache_") || k.startsWith("@offline_cache_")
            );
            if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
        } catch {}
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                refreshToken,
                user,
                isAuthenticated: !!token,
                loading,
                login,
                logout,
                checkAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
