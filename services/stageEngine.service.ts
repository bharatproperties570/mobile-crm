/**
 * Stage Engine Service — Mobile CRM
 * Mirrors the web useStageEngine.js hook, as a plain async service.
 * All calls go to /api/stage-engine/* on the backend.
 * Zero mock/dummy data.
 */

import api from "./api";

// ── Stage & Outcome Maps (identical to web stageEngine) ────────────────────

export const STAGE_COLORS: Record<string, string> = {
    New: "#94a3b8",
    Prospect: "#3b82f6",
    Qualified: "#8b5cf6",
    Opportunity: "#f59e0b",
    Negotiation: "#f97316",
    Booked: "#10b981",
    "Closed Won": "#22c55e",
    "Closed Lost": "#ef4444",
    Stalled: "#78716c",
};

const OUTCOME_TO_STAGE: Record<string, string> = {
    // Positive — move forward
    "Interested": "Qualified",
    "Follow-up Required": "Qualified",
    "Call Back Requested": "Qualified",
    "Next Step Decided": "Negotiation",
    "Price Discussion": "Negotiation",
    "Closing Soon": "Negotiation",
    "Liked Property": "Negotiation",
    "Wants More Options": "Opportunity",
    // Neutral — hold
    "Left Voicemail": "Prospect",
    "Client Busy": "Prospect",
    "Weather": "Prospect",
    "Client Requested": "Prospect",
    // Negative — keep or downgrade
    "Not Interested": "Prospect",
    "No Answer": "Prospect",
    "No response": "Prospect",
    "Call Back Later": "Prospect",
    "Invalid Lead": "Prospect",
    "No Show": "Prospect",
    "Location Issue": "Opportunity",
    "Price Issue": "Opportunity",
};

// Given an activity's outcomeStatus + result, compute the new lead stage
export function computeLeadStage(
    currentStage: string,
    outcomeStatus: string,
    result: string
): string {
    const key = result || outcomeStatus;
    return OUTCOME_TO_STAGE[key] || currentStage || "New";
}

// ── API Calls ──────────────────────────────────────────────────────────────

/**
 * Update lead stage — persists stageHistory in MongoDB.
 */
export const updateLeadStage = async (
    leadId: string,
    stage: string,
    opts: {
        activityType?: string;
        outcome?: string;
        activityId?: string;
        reason?: string;
        triggeredBy?: string;
    } = {}
) => {
    try {
        const res = await api.put(`/stage-engine/leads/${leadId}/stage`, {
            stage,
            triggeredBy: opts.triggeredBy || "activity",
            activityType: opts.activityType,
            outcome: opts.outcome,
            activityId: opts.activityId,
            reason: opts.reason,
        });
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] updateLeadStage failed:", e?.message);
        return { success: false, error: e?.message };
    }
};

/**
 * Sync deal stage from its linked lead stages.
 */
export const syncDealStage = async (
    dealId: string,
    leadStages: string[],
    opts: { reason?: string } = {}
) => {
    try {
        const res = await api.put(`/stage-engine/deals/${dealId}/sync`, {
            leadStages,
            reason: opts.reason || `Mobile sync from lead stages: [${leadStages.join(", ")}]`,
        });
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] syncDealStage failed:", e?.message);
        return { success: false, error: e?.message };
    }
};

/**
 * Get full stage history for a lead.
 */
export const getLeadStageHistory = async (leadId: string) => {
    try {
        const res = await api.get(`/stage-engine/leads/${leadId}/history`);
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] getLeadStageHistory failed:", e?.message);
        return { success: false, stageHistory: [], currentStage: null };
    }
};

/**
 * Get full stage history for a deal.
 */
export const getDealStageHistory = async (dealId: string) => {
    try {
        const res = await api.get(`/stage-engine/deals/${dealId}/history`);
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] getDealStageHistory failed:", e?.message);
        return { success: false, stageHistory: [], currentStage: null };
    }
};

/**
 * Get deal health score from real activities.
 */
export const getDealHealth = async (dealId: string) => {
    try {
        const res = await api.get(`/stage-engine/health/${dealId}`);
        return res.data?.health || null;
    } catch (e: any) {
        console.warn("[StageEngine] getDealHealth failed:", e?.message);
        return null;
    }
};

/**
 * Get stage density metrics (for dashboard use).
 */
export const getStageDensity = async () => {
    try {
        const res = await api.get("/stage-engine/density");
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] getStageDensity failed:", e?.message);
        return { success: false, density: [] };
    }
};

/**
 * Get stalled deals list.
 */
export const getStalledDeals = async (opts: {
    daysSinceStageChange?: number;
    daysNoActivity?: number;
} = {}) => {
    try {
        const params: Record<string, string> = {};
        if (opts.daysSinceStageChange) params.daysSinceStageChange = String(opts.daysSinceStageChange);
        if (opts.daysNoActivity) params.daysNoActivity = String(opts.daysNoActivity);
        const res = await api.get("/stage-engine/stalled", { params });
        return res.data;
    } catch (e: any) {
        console.warn("[StageEngine] getStalledDeals failed:", e?.message);
        return { success: false, stalledDeals: [] };
    }
};

/**
 * Bulk lead scores — optimised for list views.
 * Returns { [leadId]: { score, color, label } }
 */
export const getLeadScores = async (): Promise<Record<string, { score: number; color: string; label: string }>> => {
    try {
        const res = await api.get("/stage-engine/leads/scores");
        return res.data?.scores || {};
    } catch (e: any) {
        console.warn("[StageEngine] getLeadScores failed:", e?.message);
        return {};
    }
};

/**
 * Bulk deal scores — optimised for list views.
 * Returns { [dealId]: { score, color, label } }
 */
export const getDealScores = async (): Promise<Record<string, { score: number; color: string; label: string }>> => {
    try {
        const res = await api.get("/stage-engine/deals/scores");
        return res.data?.scores || {};
    } catch (e: any) {
        console.warn("[StageEngine] getDealScores failed:", e?.message);
        return {};
    }
};
