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
}

export async function getDashboardStats() {
    return safeApiCallSingle<DashboardStats>(() => api.get("/dashboard/stats"));
}
