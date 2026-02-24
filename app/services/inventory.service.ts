import api from "./api";

export interface Inventory {
    _id: string;
    category?: any;
    subCategory?: string;
    unitType?: string;
    projectName?: string;
    block?: string;
    location?: string;
    unitNumber?: string;
    unitNo?: string;
    intent?: any;
    status?: any;
    price?: any;
    score?: number;
    owners?: any[]; // For compatibility with inventory data actions
    size?: any;
    sizeUnit?: string;
    city?: string;
    sector?: string;
    associates?: any[];
    ownerName?: string;
    ownerPhone?: string;
    createdAt?: string;
}

export const getInventory = async (params?: Record<string, string>) => {
    const res = await api.get("/inventory", { params: { limit: "200", ...params } });
    return res.data;
};

export const getInventoryById = async (id: string) => {
    const res = await api.get(`/inventory/${id}`);
    return res.data;
};

export const updateInventory = async (id: string, data: any) => {
    const res = await api.put(`/inventory/${id}`, data);
    return res.data;
};

export const getInventoryByContact = async (contactId: string) => {
    const res = await api.get("/inventory", { params: { contactId, limit: "100" } });
    return res.data;
};
