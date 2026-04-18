import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "@/services/storage";
import api from "@/services/api";

interface AuthContextType {
    token: string | null;
    user: any | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (token: string, user: any) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
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
        try {
            const savedToken = await storage.getItem("authToken");
            const savedUser = await storage.getItem("userData");
            
            if (savedToken) {
                console.log("[AuthContext] Token found in storage");
                setToken(savedToken);
                if (savedUser) setUser(JSON.parse(savedUser));
            } else {
                console.log("[AuthContext] No token found");
            }
        } catch (error) {
            console.error("[AuthContext] Auth check error:", error);
        } finally {
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
        const { set401Callback } = require("@/services/api");
        set401Callback(() => {
            console.warn('[AuthContext] 401 Unauthorized detected, logging out...');
            setToken(null);
            setUser(null);
            clearCaches();
        });
        checkAuth();
    }, []);

    // 🚀 Redirection Engine: Handles path-based access control
    useEffect(() => {
        if (loading) return;

        // segments[0] is the root group (e.g. "(auth)" or "(tabs)")
        const group = segments[0];
        const inAuthGroup = group === '(auth)';
        const inTabsGroup = group === '(tabs)';

        // SENIOR FIX: If we are at the root path (segments.length === 0), it's a redirection decision point
        const isAtRoot = segments.length === 0;

        if (!token) {
            // Unauthenticated: Redirect to login if not already in auth flow
            if (!inAuthGroup) {
                console.log("[AuthContext] Redirecting to login (unauthenticated)");
                router.replace("/(auth)/login");
            }
        } else {
            // Authenticated: Redirect to tabs if at root or in auth flow
            if (isAtRoot || inAuthGroup) {
                console.log("[AuthContext] Redirecting to tabs (authenticated)");
                router.replace("/(tabs)");
            }
        }
    }, [token, segments, loading]);

    const login = async (newToken: string, userData: any) => {
        setToken(newToken);
        setUser(userData);
        await storage.setItem("authToken", newToken);
        await storage.setItem("userData", JSON.stringify(userData));
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        await storage.deleteItem("authToken");
        await storage.deleteItem("userData");
        await clearCaches();
    };

    return (
        <AuthContext.Provider value={{ 
            token, 
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
