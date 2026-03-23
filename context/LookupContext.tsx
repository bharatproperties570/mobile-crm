import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Lookup {
    _id: string;
    lookup_type: string;
    lookup_value: string;
    parent_id?: string;
}

interface LookupContextType {
    lookups: Lookup[];
    propertyConfig: any;
    leadMasterFields: any;
    loading: boolean;
    getLookupValue: (type: string, idOrValue: any) => string;
    getLookupsByType: (type: string) => Lookup[];
    refreshLookups: () => Promise<void>;
}

const LookupContext = createContext<LookupContextType | undefined>(undefined);

export const LookupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lookups, setLookups] = useState<Lookup[]>([]);
    const [propertyConfig, setPropertyConfig] = useState<any>(null);
    const [leadMasterFields, setLeadMasterFields] = useState<any>(null);
    const [idIndex, setIdIndex] = useState<Map<string, Lookup>>(new Map());
    const [typeIndex, setTypeIndex] = useState<Map<string, Lookup[]>>(new Map());
    const [loading, setLoading] = useState(true);

    const refreshLookups = useCallback(async (retryCount = 2) => {
        // 1. Try to load from cache first for instant UI response
        if (lookups.length === 0) {
            try {
                const [cachedLookups, cachedConfig, cachedLeadFields] = await Promise.all([
                    AsyncStorage.getItem("@cache_lookups"),
                    AsyncStorage.getItem("@cache_property_config"),
                    AsyncStorage.getItem("@cache_lead_master_fields")
                ]);

                if (cachedLookups) {
                    const parsed = JSON.parse(cachedLookups);
                    setLookups(parsed);
                    
                    const newIdIndex = new Map<string, Lookup>();
                    const newTypeIndex = new Map<string, Lookup[]>();
                    parsed.forEach((item: Lookup) => {
                        newIdIndex.set(item._id, item);
                        const type = item.lookup_type.toLowerCase();
                        if (!newTypeIndex.has(type)) newTypeIndex.set(type, []);
                        newTypeIndex.get(type)?.push(item);
                    });
                    setIdIndex(newIdIndex);
                    setTypeIndex(newTypeIndex);
                    setLoading(false); // Stop block spinner early!
                }
                if (cachedConfig) setPropertyConfig(JSON.parse(cachedConfig));
                if (cachedLeadFields) setLeadMasterFields(JSON.parse(cachedLeadFields));

            } catch (e) { console.warn("[LookupContext] Cache read failed", e); }
        }

        if (lookups.length === 0) setLoading(true);

        try {
            const res = await api.get('/lookups', { params: { limit: 2500 } });

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
                AsyncStorage.setItem("@cache_lookups", JSON.stringify(data)).catch(() => {});
                
                const newIdIndex = new Map<string, Lookup>();
                const newTypeIndex = new Map<string, Lookup[]>();

                data.forEach(item => {
                    newIdIndex.set(item._id, item);
                    const type = item.lookup_type.toLowerCase();
                    if (!newTypeIndex.has(type)) newTypeIndex.set(type, []);
                    newTypeIndex.get(type)?.push(item);
                });

                setIdIndex(newIdIndex);
                setTypeIndex(newTypeIndex);
            }

            // Fetch Property Config separately
            try {
                const configRes = await api.get('/system-settings/propertyConfig');
                if (configRes.data?.data?.value) {
                    const val = configRes.data.data.value;
                    setPropertyConfig(val);
                    AsyncStorage.setItem("@cache_property_config", JSON.stringify(val)).catch(() => {});
                }
            } catch (err) { }

            // Fetch Lead Master Fields
            try {
                const leadRes = await api.get('/system-settings/leadMasterFields');
                if (leadRes.data?.data?.value) {
                    const val = leadRes.data.data.value;
                    setLeadMasterFields(val);
                    AsyncStorage.setItem("@cache_lead_master_fields", JSON.stringify(val)).catch(() => {});
                }
            } catch (err) { }

            if (data.length === 0 && retryCount > 0) {
                setTimeout(() => refreshLookups(retryCount - 1), 1000);
            }
        } catch (error) {
            if (retryCount > 0) setTimeout(() => refreshLookups(retryCount - 1), 2000);
        } finally {
            setLoading(false);
        }
    }, [lookups.length]);

    useEffect(() => {
        refreshLookups();
    }, [refreshLookups]);

    const getLookupsByType = useCallback((type: string): Lookup[] => {
        return typeIndex.get(type.toLowerCase()) || [];
    }, [typeIndex]);

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

            // 3. Handle IDs/Strings with O(1) Map Access
            // First try direct ID match (most efficient)
            const foundById = idIndex.get(val);
            if (foundById) return foundById.lookup_value;

            // If not found by ID, handle string values or legacy types
            const normalizedType = t.toLowerCase();
            const typeGroup = typeIndex.get(normalizedType);
            
            if (typeGroup) {
                const foundInType = typeGroup.find(l => l.lookup_value === val);
                if (foundInType) return foundInType.lookup_value;
            }

            // Handle pure MongoDB ID that wasn't indexed (e.g. not a lookup)
            if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) {
                return "—";
            }

            return String(val);
        };

        return resolve(type, idOrValue);
    }, [idIndex, typeIndex]);

    return (
        <LookupContext.Provider value={{ lookups, propertyConfig, leadMasterFields, loading, getLookupValue, getLookupsByType, refreshLookups }}>
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
