import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "@/services/storage";
import api, { set401Callback } from "@/services/api";

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
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    
    // Safety check for segments
    let segments: string[] = [];
    try {
        segments = useSegments();
    } catch (e) {
        console.warn("[AuthContext] useSegments hook failed (router might not be ready)");
    }

    const checkAuth = async () => {
        setLoading(true);
        console.log("[AuthContext] Checking authentication...");
        
        // Safety timeout: Never let the app hang on loading for more than 10s
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn("[AuthContext] Auth check timed out. Forcing loading=false");
                setLoading(false);
            }
        }, 10000);

        try {
            const savedToken = await storage.getItem("authToken");
            const savedRefreshToken = await storage.getItem("refreshToken");
            const savedUser = await storage.getItem("userData");
            
            if (savedToken) {
                console.log("[AuthContext] Token found in storage");
                setToken(savedToken);
                setRefreshToken(savedRefreshToken);
                if (savedUser) {
                    try {
                        setUser(JSON.parse(savedUser));
                    } catch (e) {
                        console.warn("[AuthContext] Failed to parse userData cache");
                    }
                }
            } else {
                console.log("[AuthContext] No token found");
            }
        } catch (error) {
            console.error("[AuthContext] Auth check error:", error);
        } finally {
            clearTimeout(timeout);
            setLoading(false);
        }
    };

    const clearCaches = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith("@cache_") || k.startsWith("@offline_cache_"));
            if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
        } catch (e) {}
    }

    useEffect(() => {
        if (set401Callback) {
            set401Callback(async () => {
                console.warn('[AuthContext] 401 Unauthorized detected, performing full logout...');
                await logout();
            });
        }
        checkAuth();
    }, []);

    const [routerReady, setRouterReady] = useState(false);

    useEffect(() => {
        // Small delay to ensure router is fully mounted and segments are stable
        const timer = setTimeout(() => setRouterReady(true), 500);
        return () => clearTimeout(timer);
    }, []);

    // 🚀 Redirection Engine: Handles path-based access control
    useEffect(() => {
        if (loading || !routerReady) return;

        const group = segments?.[0];
        const inAuthGroup = group === '(auth)';
        const inTabsGroup = group === '(tabs)';
        const isAtRoot = !segments || segments.length === 0;

        // PREVENT REDIRECTION LOOPS: Check if we are ALREADY where we need to be
        if (!token) {
            if (!inAuthGroup) {
                console.log("[AuthContext] Redirecting to login (unauthenticated)");
                router.replace("/(auth)/login");
            }
        } else {
            if (isAtRoot || inAuthGroup) {
                console.log("[AuthContext] Redirecting to tabs (authenticated)");
                router.replace("/(tabs)");
            }
        }
    }, [token, segments, loading, routerReady]);

    const login = async (newToken: string, newRefreshToken: string, userData: any) => {
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        setUser(userData);
        await storage.setItem("authToken", newToken);
        await storage.setItem("refreshToken", newRefreshToken);
        await storage.setItem("userData", JSON.stringify(userData));
    };

    const logout = async () => {
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        await storage.deleteItem("authToken");
        await storage.deleteItem("refreshToken");
        await storage.deleteItem("userData");
        await clearCaches();
    };

    return (
        <AuthContext.Provider value={{ 
            token, 
            refreshToken,
            user, 
            isAuthenticated: !!token, 
            loading, 
            login, 
            logout, 
            checkAuth 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
