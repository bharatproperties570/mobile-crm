import api from "./api";
import { safeApiCallSingle } from "./api.helpers";

export interface DashboardStats {
    activities: {
        overdue: number;
        today: number;
        upcoming: number;
    };
    performance: {
        target: number;
        achieved: number;
        remaining: number;
        conversion: number;
        revenue: number;
        trend: number;
    };
    reengagedCount?: number;
    nfaCount?: number;
    leads: {
        status: string;
        count: number;
    }[];
    deals: {
        stage: string;
        count: number;
        value: number;
    }[];
    inventoryHealth: {
        status: string;
        count: number;
    }[];
    aiAlertHub?: {
        followupFailure: any[];
        hotLeads: any[];
        stuckDeals: any[];
        inventory: any[];
    };
    agenda?: {
        siteVisits: any[];
        tasks: any[];
    };
    projects?: number;
    projectList?: any[];
    recentActivityFeed?: any[];
    leadSourceStats?: { source: string; count: number }[];
    activityTypeBreakdown?: { _id: string; count: number }[];
    autoSuggestions?: {
        leads: any[];
        performance: any[];
        pipeline: any[];
        strategy: any[];
    };
    recentDeals?: any[];
}

export async function getDashboardStats(params?: { userId?: string; teamId?: string }) {
    return safeApiCallSingle<DashboardStats>(() => api.get("/dashboard/stats", { params }));
}
