import api from "./api";

export interface Deal {
    _id: string;
    dealId?: string; // SELL-345-2026
    name?: string;
    title?: string;
    projectName?: string;
    unitNo?: string;
    unitNumber?: string;
    subCategory?: string;
    price?: number;
    amount?: number; // fallback
    stage?: string;
    status?: string | { lookup_value: string };
    owner?: string | { name?: string; firstName?: string; lastName?: string; phone?: string; email?: string; mobile?: string };
    associatedContact?: string | { name?: string; firstName?: string; lastName?: string; phone?: string; email?: string; mobile?: string };
    contact?: any; // legacy fallback
    lead?: any;
    inventory?: any;
    projectId?: {
        _id: string;
        name?: string;
    } | string;
    inventoryId?: {
        _id: string;
        unitNumber?: string;
        unitNo?: string;
        subCategory?: string;
        unitType?: string;
        projectName?: string;
        block?: string;
        location?: string;
        size?: number | string;
        sizeUnit?: string;
    } | string;
    location?: string;
    closingDate?: string;
    date?: string;
    assignedTo?: string | { _id: string; name?: string; fullName?: string };
    createdAt?: string;
    tags?: string[];
    remarks?: string;
    block?: string;
    unitType?: string;
    size?: string;
    sizeUnit?: string;
    floor?: number | string;
    corner?: string;
    intent?: string | { lookup_value: string };
    quotePrice?: number;
    ratePrice?: number;
    pricingMode?: string;
    dealProbability?: number | string;
    pricingNature?: { negotiable?: boolean; fixed?: boolean };
    transactionType?: string | { lookup_value: string };
    dealType?: string | { lookup_value: string };
    commission?: {
        brokeragePercent?: number | string;
        expectedAmount?: number;
        actualAmount?: number;
        internalSplit?: { listingRM?: number; closingRM?: number };
        channelPartnerShare?: number;
    };
    partyStructure?: {
        buyer?: any;
        owner?: any;
        channelPartner?: any;
        internalRM?: any;
    };
    source?: string;
    category?: string;
    propertyType?: string;
    score?: number;
}

export const getDeals = async (params?: Record<string, string>) => {
    const res = await api.get("/deals", { params });
    return res.data;
};

export const getDealById = async (id: string) => {
    const res = await api.get(`/deals/${id}`);
    return res.data;
};

export const addDeal = async (data: Partial<Deal>) => {
    const res = await api.post("/deals", data);
    return res.data;
};

export const updateDeal = async (id: string, data: Partial<Deal>) => {
    const res = await api.put(`/deals/${id}`, data);
    return res.data;
};

export const getMatchingDeals = async (leadId: string) => {
    const res = await api.get("/deals/match", { params: { leadId } });
    return res.data;
};
