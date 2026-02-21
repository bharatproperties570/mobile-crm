import api from "./api";

export interface Inventory {
    _id: string;
    category?: any;
    subCategory?: any;
    projectName?: string;
    block?: string;
    unitNumber?: string;
    intent?: any;
    status?: any;
    price?: any;
    size?: any;
    sizeUnit?: string;
    city?: string;
    sector?: string;
    createdAt?: string;
}

export const getInventory = async (params?: Record<string, string>) => {
    const res = await api.get("/inventory", { params });
    return res.data;
};

export const getInventoryById = async (id: string) => {
    const res = await api.get(`/inventory/${id}`);
    return res.data;
};
