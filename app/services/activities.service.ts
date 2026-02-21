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
    const res = await api.get("/activities", { params });
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
