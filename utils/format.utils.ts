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
        const resolved = getLookupValue("Size", size);
        if (resolved && resolved !== size && resolved !== "—") return resolved;
    }

    // Handle { value, unit } object
    if (typeof size === 'object') {
        const val = size.value ?? size.amount;
        const unit = size.unit ?? fallbackUnit;
        if (val === undefined || val === null) return '—';
        return `${val} ${unit}`;
    }

    // Handle number or string
    return `${size} ${fallbackUnit}`;
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
    
    const inv = item.inventoryId && typeof item.inventoryId === 'object' ? item.inventoryId : null;
    
    // 1. Check direct sizeLabel (On item or inv)
    const sizeLabel = item.sizeLabel || inv?.sizeLabel;
    if (sizeLabel && typeof sizeLabel === 'string' && sizeLabel !== "—") return sizeLabel;

    // 2. Check sizeConfig lookup (On item or inv)
    const sizeConfig = item.sizeConfig || inv?.sizeConfig;
    if (sizeConfig && getLookupValue) {
        const resolved = getLookupValue("Size", sizeConfig);
        if (resolved && resolved !== sizeConfig && resolved !== "—") return resolved;
    }

    // 3. Fallback to raw size with unit
    const size = item.size ?? inv?.size;
    if (size !== undefined && size !== null) {
        const unit = item.sizeUnit || inv?.sizeUnit || 'Sq.Ft.';
        return formatSize({ value: size, unit }, 'Sq.Ft.', getLookupValue);
    }
    
    return null;
}
