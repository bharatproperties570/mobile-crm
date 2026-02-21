import api from "./api";

export interface Contact {
    _id: string;
    name?: string;       // first name in backend
    surname?: string;    // last name
    fullName?: string;   // virtual from backend
    phones?: Array<{ number: string; type?: string }>;
    emails?: Array<{ address: string; type?: string }>;
    company?: string;
    professionCategory?: { _id: string; lookup_value: string } | string;
    professionSubCategory?: { _id: string; lookup_value: string } | string;
    designation?: { _id: string; lookup_value: string } | string;
    source?: { _id: string; lookup_value: string } | string;
    subSource?: { _id: string; lookup_value: string } | string;
    campaign?: { _id: string; lookup_value: string } | string;
    owner?: string | { _id: string; fullName?: string; name?: string; email?: string };
    tags?: string[];
    description?: string;
    stage?: string;
    status?: string | { _id: string; lookup_value: string };
    personalAddress?: any;
    createdAt?: string;
}

export function contactFullName(c: Contact): string {
    return [c.name, c.surname].filter(Boolean).join(" ") || "Unknown";
}

export function contactPhone(c: Contact): string {
    return c.phones?.[0]?.number ?? "";
}

export function contactEmail(c: Contact): string {
    return c.emails?.[0]?.address ?? "";
}

export function lookupVal(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "object" && field !== null) {
        if ("lookup_value" in field) return (field as any).lookup_value ?? "—";
        if ("name" in field) return (field as any).name ?? "—";
    }
    return String(field);
}

export const getContacts = async (params?: Record<string, string>) => {
    const res = await api.get("/contacts", { params });
    return res.data;
};

export const getContactById = async (id: string) => {
    const res = await api.get(`/contacts/${id}`);
    return res.data;
};

export const createContact = async (data: any) => {
    const res = await api.post("/contacts", data);
    return res.data;
};

export const updateContact = async (id: string, data: any) => {
    const res = await api.put(`/contacts/${id}`, data);
    return res.data;
};

export const deleteContact = async (id: string) => {
    const res = await api.delete(`/contacts/${id}`);
    return res.data;
};
