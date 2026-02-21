/**
 * Centralized API response normalizer.
 * 
 * The backend uses inconsistent response shapes:
 *   - { success, data: [] }         → activities, projects, system-settings
 *   - { success, records: [] }      → leads, contacts, deals, inventory
 *   - { success, data: {records} }  → some paginated endpoints
 *   - []                            → some older endpoints
 *
 * Always call extractList(res) to get an array, regardless of backend shape.
 */

/**
 * Extract an array of items from any backend response shape.
 */
export function extractList(res: any): any[] {
    if (!res) {
        console.log("[DEBUG] extractList: res is null or undefined");
        return [];
    }
    // Already an array
    if (Array.isArray(res)) return res;
    // { success, records: [] }
    if (res.records && Array.isArray(res.records)) return res.records;
    // { success, data: [] }
    if (res.data && Array.isArray(res.data)) return res.data;
    // { success, data: { records: [] } }
    if (res.data?.records && Array.isArray(res.data.records)) return res.data.records;
    // { success, data: { data: [] } }
    if (res.data?.data && Array.isArray(res.data.data)) return res.data.data;

    console.log("[DEBUG] extractList: Could not find array in keys:", Object.keys(res));
    if (res.data) console.log("[DEBUG] extractList: res.data keys:", Object.keys(res.data));

    return [];
}

/**
 * Extract total count from any backend response shape.
 */
export function extractTotal(res: any): number {
    if (!res) return 0;
    if (typeof res.totalCount === "number") return res.totalCount;
    if (typeof res.total === "number") return res.total;
    if (typeof res.data?.totalCount === "number") return res.data.totalCount;
    const list = extractList(res);
    return list.length;
}

/**
 * Safe API call wrapper for list endpoints.
 */
export async function safeApiCall<T>(fn: () => Promise<any>): Promise<{ data: T[]; total: number; error: string | null }> {
    try {
        const res = await fn();
        return { data: extractList(res), total: extractTotal(res), error: null };
    } catch (err: any) {
        const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Network error — check your connection";
        console.error("[safeApiCall] Error:", msg, err?.response?.status);
        return { data: [], total: 0, error: msg };
    }
}

/**
 * Safe API call wrapper for single-resource endpoints.
 */
export async function safeApiCallSingle<T>(fn: () => Promise<any>): Promise<{ data: T | null; error: string | null }> {
    try {
        const res = await fn();
        // If it's a wrapper { success, data }
        const data = res.data && !Array.isArray(res.data) ? res.data : res;
        return { data, error: null };
    } catch (err: any) {
        const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Network error";
        return { data: null, error: msg };
    }
}

/**
 * Generic lookup value extractor.
 * Handles objects with lookup_value, name, or fullName keys, systems strings, and arrays.
 */
export function lookupVal(field: unknown): string {
    if (!field) return "—";
    if (Array.isArray(field)) {
        return field.map(f => lookupVal(f)).filter(v => v !== "—").join(", ") || "—";
    }
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
        if ("fullName" in field) return (field as any).fullName ?? "—";
    }
    return String(field);
}
