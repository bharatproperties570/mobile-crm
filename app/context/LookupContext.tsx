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

    const refreshLookups = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/lookups', { params: { limit: 2000 } });
            if (res.data?.success || Array.isArray(res.data?.data)) {
                setLookups(res.data.data || []);
            }
        } catch (error) {
            console.error('[LookupContext] Failed to fetch lookups:', error);
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
            // If not found by type, search globally by ID (very useful during schema migrations/misalignments)
            if (!found && typeof val === 'string' && (val.length === 24 || val.startsWith('lk_'))) {
                found = lookups.find(l => l._id === val);
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
