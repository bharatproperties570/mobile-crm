/**
 * Utility functions for formatting complex data structures in the Mobile CRM.
 */

export interface SizeObject {
    value?: number;
    unit?: string;
}

export interface PriceObject {
    value?: number;
    currency?: string;
}

/**
 * Formats a size value (object or number) into a human-readable string.
 * Handles { value: 1500, unit: 'Sq.Ft.' }, numbers, strings, and lookup IDs.
 */
export function formatSize(size: any, fallbackUnit: string = 'Sq.Ft.', getLookupValue?: (type: string, val: any) => string): string {
    if (!size && size !== 0) return '—';

    // Handle string ID (24-char hex)
    if (typeof size === 'string' && /^[a-f0-9]{24}$/i.test(size) && getLookupValue) {
        // Try resolving as 'Size' first, then 'Any'
        const resolved = getLookupValue("Size", size);
        if (resolved && resolved !== size && resolved !== "—") return resolved;

        const resolvedAny = getLookupValue("Any", size);
        if (resolvedAny && resolvedAny !== size && resolvedAny !== "—") return resolvedAny;
    }

    // Handle { value, unit } object or other descriptive objects
    if (typeof size === 'object' && size !== null) {
        // A. Standard { value, unit } or { amount, unit }
        const val = size.value ?? size.amount;
        const unit = size.unit ?? fallbackUnit;
        if (val !== undefined && val !== null) return `${val} ${unit}`;

        // B. Populated lookup object { lookup_value: '3BHK' } or { name: '3BHK' }
        const label = size.lookup_value || size.name || size.label || size.fullName || size.value;
        if (label && typeof label !== 'object') return String(label);

        // C. Recursive extraction for deeply nested populated objects
        if (label && typeof label === 'object') {
            const nested = (label as any).lookup_value || (label as any).name || (label as any).label || (label as any).value || "";
            if (nested) return String(nested);
        }

        // D. FINAL FAILSAFE: Never return [object Object]
        // If it's an object we can't parse, just return the unit or a placeholder
        return `— ${fallbackUnit}`;
    }

    // Handle number or string
    const strVal = String(size);
    if (strVal.includes('[object Object]')) return `— ${fallbackUnit}`;
    
    return `${strVal} ${fallbackUnit}`;
}

/**
 * Formats a price value (object or number) into a human-readable currency string.
 * Handles { value: 100000, currency: 'INR' }, numbers, and strings.
 */
export function formatPrice(price: any): string {
    let val: number = 0;
    let currency: string = '₹';

    if (!price && price !== 0) return "—";

    if (typeof price === 'object') {
        val = Number(price.value ?? price.amount) || 0;
        // Map currency symbol if needed
        if (price.currency === 'USD') currency = '$';
    } else {
        val = Number(price) || 0;
    }

    if (val === 0) return "—";

    if (val >= 10000000) {
        return `${currency}${(val / 10000000).toFixed(2)}Cr`;
    }
    if (val >= 100000) {
        return `${currency}${(val / 100000).toFixed(2)}L`;
    }
    
    return `${currency}${val.toLocaleString("en-IN")}`;
}

/**
 * Extracts the correct Size Label from a Deal or Inventory item
 * mimicking the Web CRM logic: getLookupValue('Size', sizeConfig) || sizeLabel
 */
export function getSizeLabel(item: any, getLookupValue?: (type: string, val: any) => string): string | null {
    if (!item) return null;
    
    // For Deals, the inventory relationship might be in inventoryId
    const inv = item.inventoryId && typeof item.inventoryId === 'object' ? item.inventoryId : null;
    
    // Helper to check if a string is a raw MongoDB ID
    const isId = (s: any) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s.trim());
    
    // FIX: Only treat as malformed if it's explicitly the CORRUPTED STRING "[object Object]"
    // If it's a real object, it's NOT malformed, just needs formatting.
    const isMalformed = (s: any) => {
        if (!s || s === "—") return true;
        if (typeof s === 'string' && s.toLowerCase().includes("[object object]")) return true;
        return false;
    };

    // 1. Check direct sizeLabel (On item or connected inventory)
    let rawLabel = item.sizeLabel || item.size_label || "";
    if (isMalformed(rawLabel)) {
        rawLabel = inv?.sizeLabel || inv?.size_label || "";
    }
    
    if (typeof rawLabel === 'string' && !isMalformed(rawLabel)) {
        if (isId(rawLabel)) {
            if (getLookupValue) {
                const resolved = getLookupValue("Size", rawLabel);
                if (resolved && !isId(resolved) && !isMalformed(resolved)) return resolved;
                
                const resolvedAny = getLookupValue("Any", rawLabel);
                if (resolvedAny && !isId(resolvedAny) && !isMalformed(resolvedAny)) return resolvedAny;
            }
        } else {
            return rawLabel;
        }
    }

    // 2. Check sizeConfig lookup (On item or connected inventory)
    let sizeConfig = item.sizeConfig || item.size_config;
    if (isMalformed(sizeConfig)) {
        sizeConfig = inv?.sizeConfig || inv?.size_config;
    }
    
    if (sizeConfig && !isMalformed(sizeConfig)) {
        // Handle if sizeConfig is already a populated object from backend
        if (typeof sizeConfig === 'object' && sizeConfig !== null) {
            const val = sizeConfig.lookup_value || sizeConfig.name || sizeConfig.label || sizeConfig.value;
            if (val && typeof val !== 'object' && !isMalformed(val)) return String(val);
            if (typeof val === 'object' && val !== null) {
                const nestedVal = (val as any).lookup_value || (val as any).name || (val as any).label || (val as any).value || "";
                if (nestedVal && !isMalformed(nestedVal)) return String(nestedVal);
            }
        }

        // Handle if sizeConfig is a string ID that needs lookup resolution
        if (getLookupValue && typeof sizeConfig === 'string') {
            const resolved = getLookupValue("Size", sizeConfig);
            if (resolved && !isId(resolved) && !isMalformed(resolved)) return String(resolved);

            const resolvedAny = getLookupValue("Any", sizeConfig);
            if (resolvedAny && !isId(resolvedAny) && !isMalformed(resolvedAny)) return String(resolvedAny);
        }
    }

    // 3. Fallback to raw size value with unit (On item or connected inventory)
    let sizeValue = item.size ?? item.area;
    let unit = item.sizeUnit || item.unit;

    if (isMalformed(sizeValue)) {
        sizeValue = inv?.size ?? inv?.area;
        unit = inv?.sizeUnit ?? inv?.unit;
    }

    if (sizeValue !== undefined && sizeValue !== null && sizeValue !== "" && !isMalformed(sizeValue)) {
        unit = unit || 'Sq.Ft.';
        // If it's a string ID, try to resolve it as a size label one more time
        if (typeof sizeValue === 'string' && isId(sizeValue) && getLookupValue) {
            const res = getLookupValue("Size", sizeValue) || getLookupValue("Any", sizeValue);
            if (res && !isId(res)) return res;
        }
        
        const formatted = formatSize(sizeValue, unit, getLookupValue);
        if (formatted && !formatted.includes("[object Object]")) {
            return String(formatted);
        }
    }
    
    return "—";
}
