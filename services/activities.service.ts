import api from "./api";

export interface Activity {
    _id?: string;
    type: "Call" | "Meeting" | "Site Visit" | "Task" | "Email";
    subject: string;
    entityType: string;
    entityId: string;
    relatedTo?: Array<{
        id: string;
        name: string;
        model: string;
        mobile?: string;
    }>;
    dueDate: string;
    dueTime?: string;
    priority: "Low" | "Normal" | "High";
    status: "Pending" | "In Progress" | "Completed" | "Deferred" | "Overdue";
    description?: string;
    details?: any;
    assignedTo?: any;
    createdAt?: string;
}

export const getActivities = async (params: any = {}) => {
    const res = await api.get("/activities", { params: { limit: "200", ...params } });
    return res.data;
};

export const getActivityById = async (id: string) => {
    const res = await api.get(`/activities/${id}`);
    return res.data;
};

export const addActivity = async (data: any) => {
    const res = await api.post("/activities", data);
    return res.data;
};

export const updateActivity = async (id: string, data: any) => {
    const res = await api.put(`/activities/${id}`, data);
    return res.data;
};

export const deleteActivity = async (id: string) => {
    const res = await api.delete(`/activities/${id}`);
    return res.data;
};

export const getOrCreateCallActivity = async (entityId: string, entityType: string, subject: string, mobile?: string) => {
    try {
        // 1. Search for existing pending call activities
        const actRes = await getActivities({
            entityId,
            entityType,
            type: "Call",
            status: "Pending",
            limit: "1"
        });

        const activities = actRes?.data ?? actRes;
        if (Array.isArray(activities) && activities.length > 0) {
            return activities[0];
        }

        // 2. If no pending call activity, create one for 'Now'
        const now = new Date();
        const newActivity = {
            type: "Call",
            subject: `Call: ${subject}`,
            entityType,
            entityId,
            relatedTo: [{
                id: entityId,
                name: subject,
                model: entityType,
                mobile: mobile
            }],
            dueDate: now.toISOString().split('T')[0],
            dueTime: now.toTimeString().slice(0, 5),
            priority: "Normal",
            status: "Pending",
            description: "Automatically created for call outcome tracking."
        };

        const createRes = await addActivity(newActivity);
        return createRes?.data ?? createRes;
    } catch (e) {
        console.error("Error in getOrCreateCallActivity:", e);
        throw e;
    }
};
export const getUnifiedTimeline = async (entityType: string, entityId: string) => {
    const res = await api.get(`/activities/unified/${entityType}/${entityId}`);
    return res.data;
};
