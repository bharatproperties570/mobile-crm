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
    const res = await api.get("/contacts", { params: { limit: "200", ...params } });
    return res.data;
};

export const getLeads = async (params?: Record<string, string>) => {
    const res = await api.get("/leads", { params: { limit: "200", ...params } });
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

export interface CallerInfo {
    name: string;
    type: 'Lead' | 'Deal' | 'Inventory' | 'Contact';
    projectName?: string;
    unitNumber?: string;
    activity?: string;
    entityId: string;
}

export const lookupCallerInfo = async (phoneNumber: string): Promise<CallerInfo | null> => {
    try {
        // 1. Check Leads
        const leadsRes = await getLeads({ mobile: phoneNumber });
        const leads = extractList(leadsRes.data);
        if (leads.length > 0) {
            const lead = leads[0];
            return {
                name: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead",
                type: 'Lead',
                projectName: lead.projectName?.[0],
                entityId: lead._id
            };
        }

        // 2. Check Deals
        const dealsRes = await api.get("/deals", { params: { contactPhone: phoneNumber } });
        const deals = extractList(dealsRes.data);
        if (deals.length > 0) {
            const deal = deals[0];
            return {
                name: deal.projectName || "Deal",
                type: 'Deal',
                projectName: deal.projectName,
                unitNumber: deal.unitNumber || deal.unitNo,
                entityId: deal._id
            };
        }

        // 3. Check Inventory
        const invRes = await api.get("/inventory", { params: { ownerPhone: phoneNumber } });
        const inventories = extractList(invRes.data);
        if (inventories.length > 0) {
            const inv = inventories[0];
            return {
                name: inv.projectName || "Inventory",
                type: 'Inventory',
                projectName: inv.projectName,
                unitNumber: inv.unitNumber || inv.unitNo,
                entityId: inv._id
            };
        }

        // 4. Check Contacts
        const contactsRes = await getContacts({ phone: phoneNumber });
        const contacts = extractList(contactsRes.data);
        if (contacts.length > 0) {
            const contact = contacts[0];
            return {
                name: [contact.name, contact.surname].filter(Boolean).join(" ") || "Contact",
                type: 'Contact',
                entityId: contact._id
            };
        }

        return null;
    } catch (error) {
        console.error("Error looking up caller info:", error);
        return null;
    }
};

const extractList = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data?.docs && Array.isArray(data.docs)) return data.docs;
    return [];
};
