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
    login: (token: string, user?: any) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    console.log(`[AuthContext] State: loading=${loading}, token=${!!token}, segment=${segments[0]}`);

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

    useEffect(() => {
        // Redirection logic
        if (loading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!token && !inAuthGroup) {
            // Redirect to login if not authenticated and not in auth group
            router.replace('/(auth)/login');
        } else if (token && inAuthGroup) {
            // Redirect to home if authenticated and in auth group
            router.replace('/(tabs)');
        }
    }, [token, loading, segments]);

    const checkAuth = async () => {
        try {
            const savedToken = await storage.getItem('authToken');
            if (savedToken) {
                setToken(savedToken);
                // Optionally fetch user profile here
            }
        } catch (error) {
            console.error('[AuthContext] Error checking auth:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (newToken: string, userData?: any) => {
        await storage.setItem('authToken', newToken);
        setToken(newToken);
        if (userData) setUser(userData);
    };

    const clearCaches = async () => {
        const cacheKeys = [
            "@cache_leads_list",
            "@cache_deals_list",
            "@cache_inventory_list",
            "@cache_lookups",
            "@cache_property_config",
            "@cache_lead_master_fields",
            "@cache_users",
            "@cache_teams"
        ];
        try {
            await AsyncStorage.multiRemove(cacheKeys);
            console.log("[AuthContext] CRM Caches cleared");
        } catch (e) {
            console.warn("[AuthContext] Failed to clear caches", e);
        }
    };

    const logout = async () => {
        await storage.deleteItem('authToken');
        setToken(null);
        setUser(null);
        await clearCaches();
    };

    return (
        <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
