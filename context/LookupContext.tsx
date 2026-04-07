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

        // 0. Helper: Recursive Search in propertyConfig
        const findInConfig = (id: string, obj: any): string | null => {
            if (!obj || typeof obj !== 'object') return null;

            // If it's an array, scan items
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = findInConfig(id, item);
                    if (found) return found;
                }
                return null;
            }

            // If this object is a match
            if (obj._id === id || obj.id === id) {
                return obj.lookup_value || obj.name || obj.label || obj.fullName || null;
            }

            // Otherwise, recurse into all object keys (like 'subCategories', 'fields', 'options', etc.)
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
                    const found = findInConfig(id, obj[key]);
                    if (found) return found;
                }
            }

            return null;
        };

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
                const resolvedVal = val.lookup_value || val.name || val.fullName || val.label || val.value || "—";
                return typeof resolvedVal === 'object' ? "—" : String(resolvedVal);
            }

            // 3. Handle IDs/Strings
            const idVal = String(val).trim();

            // A. Check idIndex (O(1) global lookups)
            const foundById = idIndex.get(idVal);
            if (foundById) return foundById.lookup_value;

            // B. Check typeIndex (legacy fallback)
            const normalizedType = t.toLowerCase();
            const typeGroup = typeIndex.get(normalizedType);
            if (typeGroup) {
                const foundInType = typeGroup.find(l => l.lookup_value === idVal);
                if (foundInType) return foundInType.lookup_value;
            }

            // C. DEEP SEARCH in propertyConfig (V2 Fix for project-specific IDs)
            if (propertyConfig && typeof idVal === 'string' && /^[a-f0-9]{24}$/i.test(idVal)) {
                const foundInConfig = findInConfig(idVal, propertyConfig);
                if (foundInConfig) return foundInConfig;
            }

            // D. Fallback to any lookup (type-insensitive search)
            // Sometimes a "Size" ID is asked as "Any" type or vice versa
            if (typeof idVal === 'string' && /^[a-f0-9]{24}$/i.test(idVal)) {
               // We already checked idIndex (Map), but maybe it's untyped in lookups? 
               // Actually idIndex is global. If it's not in idIndex, it's not in lookups.
            }

            // Fallback to Raw String
            // Handle pure MongoDB ID that wasn't indexed anywhere
            if (typeof idVal === 'string' && /^[a-f0-9]{24}$/i.test(idVal)) {
                return "—";
            }

            return idVal;
        };

        return resolve(type, idOrValue);
    }, [idIndex, typeIndex, propertyConfig]);

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
