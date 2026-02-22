import api from "./api";
import { lookupVal } from "./api.helpers";

export interface Lead {
    _id: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
    email?: string;
    status?: { _id: string; lookup_value: string } | string;
    source?: { _id: string; lookup_value: string } | string;
    requirement?: { _id: string; lookup_value: string } | string;
    budget?: { _id: string; lookup_value: string } | string;
    location?: { _id: string; lookup_value: string } | string;
    owner?: { _id: string; name?: string; fullName?: string } | string;
    assignment?: { assignedTo?: { _id: string; name?: string; fullName?: string } | string };
    createdAt?: string;
    description?: string;
    salutation?: string;
    // Extended fields
    locCity?: string;
    budgetMin?: number;
    budgetMax?: number;
    projectName?: string[];
    subRequirement?: { _id: string; lookup_value: string } | string;
    subType?: ({ _id: string; lookup_value: string } | string)[];
    unitType?: ({ _id: string; lookup_value: string } | string)[];
    propertyType?: ({ _id: string; lookup_value: string } | string)[];
    tags?: string[];
    locRange?: number;
    projectTowers?: string[];
    propertyNo?: string;
    propertyNoEnd?: string;
    unitSelectionMode?: string;
}

export function leadName(lead: Lead): string {
    return [lead.salutation, lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
}


export const getLeads = async (params?: Record<string, string>) => {
    const res = await api.get("/leads", { params });
    return res.data;
};

export const getLeadById = async (id: string) => {
    const res = await api.get(`/leads/${id}`);
    return res.data;
};

export const addLead = async (data: Partial<Lead>) => {
    // Sanitize data: convert empty strings to undefined or null for ObjectId/Reference fields
    const sanitizedData = { ...data };
    Object.keys(sanitizedData).forEach(key => {
        if ((sanitizedData as any)[key] === "") {
            (sanitizedData as any)[key] = undefined;
        }
    });

    const res = await api.post("/leads", sanitizedData);
    return res.data;
};

export const checkDuplicates = async (data: any) => {
    const res = await api.post("/duplication-rules/check", {
        entityType: "Lead",
        data: {
            ...data,
            firstName: data.firstName || data.name || "",
            mobile: data.mobile || (data.phones?.[0]?.number) || "",
            email: data.email || (data.emails?.[0]?.address) || ""
        }
    });
    return res.data;
};

export const deleteLead = async (id: string) => {
    const res = await api.delete(`/leads/${id}`);
    return res.data;
};

export const updateLead = async (id: string, data: Partial<Lead>) => {
    const res = await api.put(`/leads/${id}`, data);
    return res.data;
};
