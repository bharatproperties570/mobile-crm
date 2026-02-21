import api from "./api";
import { safeApiCallSingle } from "./api.helpers";

export interface DashboardStats {
    activities: {
        overdue: number;
        today: number;
        upcoming: number;
    };
    leads: {
        status: string;
        count: number;
    }[];
    deals: {
        stage: string;
        count: number;
    }[];
}

export async function getDashboardStats() {
    return safeApiCallSingle<DashboardStats>(() => api.get("/dashboard/stats"));
}
