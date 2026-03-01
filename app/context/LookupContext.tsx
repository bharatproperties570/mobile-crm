import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface Lookup {
    _id: string;
    lookup_type: string;
    lookup_value: string;
    parent_id?: string;
}

interface LookupContextType {
    lookups: Lookup[];
    loading: boolean;
    getLookupValue: (type: string, idOrValue: any) => string;
    refreshLookups: () => Promise<void>;
}

const LookupContext = createContext<LookupContextType | undefined>(undefined);

export const LookupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lookups, setLookups] = useState<Lookup[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshLookups = useCallback(async (retryCount = 2) => {
        setLoading(true);
        try {
            const res = await api.get('/lookups', { params: { limit: 2000 } });

            // Centralized extraction logic (similar to extractList)
            let data: Lookup[] = [];
            const responseData = res.data;

            if (Array.isArray(responseData)) {
                data = responseData;
            } else if (responseData?.data && Array.isArray(responseData.data)) {
                data = responseData.data;
            } else if (responseData?.records && Array.isArray(responseData.records)) {
                data = responseData.records;
            } else if (responseData?.success && responseData?.data && Array.isArray(responseData.data)) {
                data = responseData.data;
            }

            if (data.length > 0) {
                setLookups(data);
            } else if (retryCount > 0) {
                console.log(`[LookupContext] Empty lookup response, retrying... (${retryCount} left)`);
                setTimeout(() => refreshLookups(retryCount - 1), 1000);
            }
        } catch (error) {
            console.error('[LookupContext] Failed to fetch lookups:', error);
            if (retryCount > 0) {
                console.log(`[LookupContext] Error fetching lookups, retrying... (${retryCount} left)`);
                setTimeout(() => refreshLookups(retryCount - 1), 2000);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshLookups();
    }, [refreshLookups]);

    const getLookupValue = useCallback((type: string, idOrValue: any): string => {
        if (!idOrValue) return "—";

        const resolve = (t: string, val: any): string => {
            if (!val) return "—";

            // 1. Handle arrays recursively
            if (Array.isArray(val)) {
                if (val.length === 0) return "—";
                return val
                    .map(item => resolve(t, item))
                    .filter(x => x && x !== "—")
                    .join(", ") || "—";
            }

            // 2. Handle objects (already populated by backend)
            if (typeof val === 'object' && val !== null) {
                return val.lookup_value || val.name || val.fullName || "—";
            }

            // 3. Handle IDs/Strings
            const normalizedType = t.toLowerCase();
            let found = lookups.find(l =>
                l.lookup_type.toLowerCase() === normalizedType &&
                (l._id === val || l.lookup_value === val)
            );

            // ─── Robust Fallback ───
            // If not found by type, search globally by ID
            if (!found && typeof val === 'string' && (val.length === 24 || val.startsWith('lk_'))) {
                found = lookups.find(l => l._id === val);
            }

            if (!found) {
                console.log(`[LookupContext] ⚠️ Failed to resolve ${t} with value:`, val, "(Lookups loaded: " + lookups.length + ")");
            }

            return found ? found.lookup_value : String(val);
        };

        return resolve(type, idOrValue);
    }, [lookups]);

    return (
        <LookupContext.Provider value={{ lookups, loading, getLookupValue, refreshLookups }}>
            {children}
        </LookupContext.Provider>
    );
};

export const useLookup = () => {
    const context = useContext(LookupContext);
    if (!context) {
        throw new Error('useLookup must be used within a LookupProvider');
    }
    return context;
};
