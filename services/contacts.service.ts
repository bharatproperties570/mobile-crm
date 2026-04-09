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
    team?: string | { _id: string; name: string };
    teams?: Array<string | { _id: string; name: string }>;
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
    mobile?: string;
    // Enhanced Fields for Professional Caller ID
    intent?: string;           // Buy / Rent / Sell
    subCategory?: string;      // 3BHK, Commercial Plot, etc.
    budget?: string;           // Max Budget or Budget Range
    status?: string;           // High-level status (Qualified, Warm, etc.)
}

export const lookupCallerInfo = async (phoneNumber: string): Promise<CallerInfo | null> => {
    try {
        const clean = (num: string) => (num || "").replace(/[^0-9]/g, "").slice(-10);
        const cleanedPhone = clean(phoneNumber);
        if (!cleanedPhone) return null;

        const getVal = (field: any) => {
            if (!field) return undefined;
            if (typeof field === 'object') return field.lookup_value || field.name || field.fullName || field.label;
            return field;
        };

        // Performance: Concurrent parallel lookups for zero-latency identification
        const [leadsRes, dealsRes, invRes, contactsRes] = await Promise.allSettled([
            getLeads({ mobile: cleanedPhone }),
            api.get("/deals", { params: { contactPhone: cleanedPhone } }),
            api.get("/inventory", { params: { ownerPhone: cleanedPhone } }),
            getContacts({ phone: cleanedPhone })
        ]);

        // 1. Leads Primary
        if (leadsRes.status === 'fulfilled') {
            const leads = extractList(leadsRes.value.data);
            if (leads.length > 0) {
                const lead = leads[0];
                return {
                    name: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead",
                    type: 'Lead',
                    projectName: lead.projectName?.[0] || lead.project?.name,
                    entityId: lead._id,
                    mobile: phoneNumber,
                    intent: getVal(lead.requirement),
                    subCategory: getVal(lead.subType?.[0]) || getVal(lead.subRequirement),
                    budget: lead.budgetMax ? `₹${(lead.budgetMax / 10000000).toFixed(2)}Cr` : getVal(lead.budget),
                    status: getVal(lead.stage)
                };
            }
        }

        // 2. Deals High Priority
        if (dealsRes.status === 'fulfilled') {
            const deals = extractList(dealsRes.value.data);
            if (deals.length > 0) {
                const deal = deals[0];
                return {
                    name: deal.partyStructure?.buyer?.name || deal.projectName || "Deal",
                    type: 'Deal',
                    projectName: deal.projectName,
                    unitNumber: deal.unitNumber || deal.unitNo || deal.dealId,
                    entityId: deal._id,
                    mobile: phoneNumber,
                    intent: deal.intent || deal.dealType,
                    subCategory: getVal(deal.subCategory) || deal.unitType,
                    budget: deal.price ? `₹${(deal.price / 10000000).toFixed(2)}Cr` : undefined,
                    status: deal.stage
                };
            }
        }

        // 3. Inventory Owner Context
        if (invRes.status === 'fulfilled') {
            const inventories = extractList(invRes.value.data);
            if (inventories.length > 0) {
                const inv = inventories[0];
                return {
                    name: inv.ownerName || inv.projectName || "Inventory",
                    type: 'Inventory',
                    projectName: inv.projectName,
                    unitNumber: inv.unitNumber || inv.unitNo,
                    entityId: inv._id,
                    mobile: phoneNumber,
                    intent: inv.intent || 'Sell',
                    subCategory: inv.subCategory || inv.unitType,
                    budget: inv.price ? `₹${(inv.price / 10000000).toFixed(2)}Cr` : undefined,
                    status: inv.status
                };
            }
        }

        // 4. Contacts General
        if (contactsRes.status === 'fulfilled') {
            const contacts = extractList(contactsRes.value.data);
            if (contacts.length > 0) {
                const contact = contacts[0];
                return {
                    name: [contact.name, contact.surname].filter(Boolean).join(" ") || "Contact",
                    type: 'Contact',
                    entityId: contact._id,
                    mobile: phoneNumber,
                    intent: getVal(contact.professionCategory),
                    status: getVal(contact.stage)
                };
            }
        }

        return null;
    } catch (e) {
        console.error("lookupCallerInfo Error:", e);
        return null;
    }
};

const extractList = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data?.docs && Array.isArray(data.docs)) return data.docs;
    return [];
};
