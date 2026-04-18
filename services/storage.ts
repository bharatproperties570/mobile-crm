import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Cross-platform storage with safety timeouts to prevent startup hangs.
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`[Storage] Operation timed out after ${timeoutMs}ms`);
            resolve(fallback);
        }, timeoutMs))
    ]);
};

export const storage = {
    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === "web") {
            try { return localStorage.getItem(key); } catch(e) { return null; }
        }
        // Safety timeout of 3s for native storage to prevent white screen hangs
        return withTimeout(SecureStore.getItemAsync(key), 3000, null);
    },

    async setItem(key: string, value: string): Promise<void> {
        if (Platform.OS === "web") {
            try { localStorage.setItem(key, value); } catch(e) {}
            return;
        }
        await withTimeout(SecureStore.setItemAsync(key, value), 5000, undefined);
    },

    async deleteItem(key: string): Promise<void> {
        if (Platform.OS === "web") {
            try { localStorage.removeItem(key); } catch(e) {}
            return;
        }
        await withTimeout(SecureStore.deleteItemAsync(key), 5000, undefined);
    },
};
