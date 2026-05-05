import api from "./api";

/**
 * field-rules.service.ts — Mobile CRM
 *
 * Enterprise Field Rule Validation Engine (Mobile Port)
 *
 * Architecture:
 *   1. Rules fetched from backend (GET /api/field-rules?module=lead)
 *   2. Cached in module-level cache — TTL: 5 minutes (avoids re-fetch per form open)
 *   3. validateEntity() logic is a faithful port of Web CRM's fieldRuleEngine.js
 *   4. Graceful degradation: if backend unreachable → hardcoded seed rules apply
 *
 * Rule Types:
 *   MANDATORY  → Field must have a value
 *   VALIDATION → Field must match pattern/regex
 *   READ_ONLY  → Informational only (UI can disable the field)
 *   HIDDEN     → Field should not be shown
 *   UNIQUE     → Async uniqueness check (not applicable on mobile — backend handles via duplication rules)
 */

export interface FieldRule {
    id: string;
    _id?: string;
    module: "lead" | "contact" | "deal" | "inventory" | "activity";
    ruleName: string;
    field: string;
    ruleType: "MANDATORY" | "READ_ONLY" | "HIDDEN" | "VALIDATION" | "UNIQUE";
    isActive: boolean;
    matchType?: "AND" | "OR";
    conditions?: FieldRuleCondition[];
    validationType?: "PATTERN" | "REGEX";
    patternName?: string;
    value?: string;
    message?: string;
}

export interface FieldRuleCondition {
    field: string;
    operator: string;
    value: string | string[] | number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;     // { fieldName: "Error message" }
    readonlyFields: string[];
    hiddenFields: string[];
}

// ── Module-level Rule Cache (TTL: 5 minutes) ─────────────────────────────────
const _cache: Record<string, { rules: FieldRule[]; expiresAt: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Seed Rules (Fallback when backend unreachable) ───────────────────────────
const SEED_RULES: FieldRule[] = [
    {
        id: "lr-1",
        module: "lead",
        ruleName: "Requirement is Mandatory",
        field: "requirement",
        ruleType: "MANDATORY",
        isActive: true,
        conditions: [],
        message: "Requirement type (Buy/Rent) is required.",
    },
    {
        id: "lr-2",
        module: "lead",
        ruleName: "Budget Mandatory for Prospects",
        field: "budgetMin",
        ruleType: "MANDATORY",
        isActive: true,
        matchType: "AND",
        conditions: [
            { field: "stage", operator: "not_equals", value: "New" },
            { field: "stage", operator: "not_equals", value: "Prospect" },
        ],
        message: "Budget is required for leads in Prospect stage or higher.",
    },
    {
        id: "dr-1",
        module: "deal",
        ruleName: "Expected Price Mandatory",
        field: "expectedPrice",
        ruleType: "MANDATORY",
        isActive: true,
        conditions: [],
        message: "Expected Price is critical for deal tracking.",
    },
];

// ── Named Patterns (mirrors Web CRM's fieldRuleEngine.js) ────────────────────
const PATTERNS: Record<string, { regex: RegExp; message: string }> = {
    EMAIL:         { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,                                                  message: "Invalid email format" },
    INDIAN_MOBILE: { regex: /^[6-9]\d{9}$/,                                                               message: "Invalid 10-digit Indian Mobile Number" },
    PAN_CARD:      { regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,                                                message: "Invalid PAN Card Number" },
    GST_NUMBER:    { regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,               message: "Invalid GST Number" },
    PIN_CODE:      { regex: /^[1-9][0-9]{5}$/,                                                            message: "Invalid PIN Code" },
};

// ── Condition Evaluator (port of Web CRM fieldRuleEngine evaluateCondition) ──
const evaluateCondition = (data: Record<string, any>, condition: FieldRuleCondition): boolean => {
    const fieldValue = data[condition.field];
    const { operator, value } = condition;

    switch (operator) {
        case "equals":       return fieldValue == value;
        case "not_equals":   return fieldValue != value;
        case "contains":     return String(fieldValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
        case "not_contains": return !String(fieldValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
        case "greater_than": return Number(fieldValue) > Number(value);
        case "less_than":    return Number(fieldValue) < Number(value);
        case "is_empty":     return fieldValue === null || fieldValue === undefined || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0);
        case "is_not_empty": return !(fieldValue === null || fieldValue === undefined || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0));
        case "in":           return Array.isArray(value) ? (value as string[]).includes(fieldValue) : false;
        case "not_in":       return Array.isArray(value) ? !(value as string[]).includes(fieldValue) : true;
        default:             return true;
    }
};

const evaluateConditions = (data: Record<string, any>, rule: FieldRule): boolean => {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    if (rule.matchType === "OR") {
        return rule.conditions.some(c => evaluateCondition(data, c));
    }
    return rule.conditions.every(c => evaluateCondition(data, c));
};

// ── Core Validation Engine (faithful port of validateEntity from fieldRuleEngine.js) ──
export const validateEntity = (
    module: FieldRule["module"],
    data: Record<string, any>,
    rules: FieldRule[]
): ValidationResult => {
    const result: ValidationResult = {
        isValid: true,
        errors: {},
        readonlyFields: [],
        hiddenFields: [],
    };

    const activeRules = rules.filter(r => r.module === module && r.isActive);

    activeRules.forEach(rule => {
        const applies = evaluateConditions(data, rule);
        if (!applies) return;

        // MANDATORY
        if (rule.ruleType === "MANDATORY") {
            const val = data[rule.field];
            const isEmpty =
                val === null || val === undefined || val === "" ||
                (Array.isArray(val) && val.length === 0);
            if (isEmpty) {
                result.isValid = false;
                result.errors[rule.field] = rule.message ?? `${rule.field} is required.`;
            }
        }

        // READ ONLY
        if (rule.ruleType === "READ_ONLY") {
            result.readonlyFields.push(rule.field);
        }

        // HIDDEN
        if (rule.ruleType === "HIDDEN") {
            result.hiddenFields.push(rule.field);
        }

        // VALIDATION (Pattern / Regex)
        if (rule.ruleType === "VALIDATION" && rule.validationType) {
            const val = data[rule.field];
            if (val) {
                if (rule.validationType === "PATTERN" && rule.patternName) {
                    const pattern = PATTERNS[rule.patternName];
                    if (pattern && !pattern.regex.test(val)) {
                        result.isValid = false;
                        result.errors[rule.field] = rule.message ?? pattern.message;
                    }
                } else if (rule.validationType === "REGEX" && rule.value) {
                    const regex = new RegExp(rule.value);
                    if (!regex.test(val)) {
                        result.isValid = false;
                        result.errors[rule.field] = rule.message ?? `Invalid format for ${rule.field}`;
                    }
                }
            }
        }
    });

    return result;
};

// ── Rule Fetcher with Cache ───────────────────────────────────────────────────
export const getFieldRules = async (module: FieldRule["module"]): Promise<FieldRule[]> => {
    const now = Date.now();
    const cached = _cache[module];

    // Return cached rules if still fresh
    if (cached && cached.expiresAt > now) {
        return cached.rules;
    }

    try {
        const { data } = await api.get(`/field-rules/module/${module}`);
        const rules: FieldRule[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.rules)
            ? data.rules
            : [];

        _cache[module] = { rules, expiresAt: now + CACHE_TTL_MS };
        return rules;
    } catch (err) {
        console.warn(`[FieldRulesService] Backend unavailable — using seed rules for module: ${module}`);
        const seedRules = SEED_RULES.filter(r => r.module === module);
        _cache[module] = { rules: seedRules, expiresAt: now + CACHE_TTL_MS };
        return seedRules;
    }
};

/**
 * Validate entity data against backend field rules.
 * Fetches rules (from cache or backend), then runs validateEntity.
 *
 * @param module - Module name
 * @param data   - Flattened data object to validate
 * @returns ValidationResult with isValid, errors, readonlyFields, hiddenFields
 */
export const validateWithFieldRules = async (
    module: FieldRule["module"],
    data: Record<string, any>
): Promise<ValidationResult> => {
    const rules = await getFieldRules(module);
    return validateEntity(module, data, rules);
};

/**
 * Invalidate the cache for a module (call after admin changes field rules).
 */
export const invalidateFieldRuleCache = (module?: FieldRule["module"]) => {
    if (module) {
        delete _cache[module];
    } else {
        Object.keys(_cache).forEach(k => delete _cache[k]);
    }
};
