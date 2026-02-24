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

        // Handle object if already populated
        if (typeof idOrValue === 'object') {
            return idOrValue.lookup_value || idOrValue.name || idOrValue.fullName || "—";
        }

        // If it's a string, try to find it in the cached lookups
        const normalizedType = type.toLowerCase();
        const found = lookups.find(l =>
            l.lookup_type.toLowerCase() === normalizedType &&
            (l._id === idOrValue || l.lookup_value === idOrValue)
        );

        return found ? found.lookup_value : String(idOrValue);
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
