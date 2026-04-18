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
    
    // Malformed check: handles null, placeholder, or corrupted string
    const isMalformed = (s: any) => {
        if (!s || s === "—") return true;
        if (typeof s === 'string' && s.toLowerCase().includes("[object object]")) return true;
        return false;
    };

    // 1. Try resolving explicit labels (sizeLabel, unitSpecification.sizeLabel)
    const possibleLabels = [
        item.sizeLabel, item.size_label, 
        item.unitSpecification?.sizeLabel,
        inv?.sizeLabel, inv?.size_label,
        inv?.unitSpecification?.sizeLabel
    ];

    for (const raw of possibleLabels) {
        if (raw && !isMalformed(raw)) {
            if (isId(raw)) {
                if (getLookupValue) {
                    const res = getLookupValue("Size", raw) || getLookupValue("Any", raw);
                    if (res && !isId(res) && !isMalformed(res)) return res;
                }
            } else if (typeof raw === 'string') {
                return raw;
            } else if (typeof raw === 'object') {
                const label = (raw as any).lookup_value || (raw as any).name || (raw as any).label || (raw as any).value;
                if (label && typeof label !== 'object' && !isMalformed(label)) return String(label);
            }
        }
    }

    // 2. Try resolving configurations (sizeConfig, unitSpecification.sizeConfig)
    const possibleConfigs = [
        item.sizeConfig, item.size_config,
        item.unitSpecification?.sizeConfig,
        inv?.sizeConfig, inv?.size_config,
        inv?.unitSpecification?.sizeConfig
    ];

    for (const conf of possibleConfigs) {
        if (conf && !isMalformed(conf)) {
            if (typeof conf === 'object' && conf !== null) {
                const val = conf.lookup_value || conf.name || conf.label || conf.value;
                if (val && typeof val !== 'object' && !isMalformed(val)) return String(val);
                if (typeof val === 'object' && val !== null) {
                    const nestedVal = (val as any).lookup_value || (val as any).name || (val as any).label || (val as any).value || "";
                    if (nestedVal && !isMalformed(nestedVal)) return String(nestedVal);
                }
            }
            if (getLookupValue && typeof conf === 'string') {
                const res = getLookupValue("Size", conf) || getLookupValue("Any", conf);
                if (res && !isId(res) && !isMalformed(res)) return String(res);
            }
        }
    }

    // 3. Fallback to raw size value with unit
    const sizeVal = item.size ?? item.area ?? inv?.size ?? inv?.area;
    const unit = item.sizeUnit || item.unit || inv?.sizeUnit || inv?.unit;

    if (sizeVal !== undefined && sizeVal !== null && sizeVal !== "" && !isMalformed(sizeVal)) {
        if (typeof sizeVal === 'string' && isId(sizeVal) && getLookupValue) {
            const res = getLookupValue("Size", sizeVal) || getLookupValue("Any", sizeVal);
            if (res && !isId(res) && !isMalformed(res)) return res;
        }
        
        const formatted = formatSize(sizeVal, unit || 'Sq.Ft.', getLookupValue);
        if (formatted && !formatted.includes("[object Object]")) {
            return String(formatted);
        }
    }
    
    return "—";
}
