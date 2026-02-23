import api from "./api";
import { lookupVal } from "./api.helpers";

export interface Company {
    _id: string;
    name: string;
    phones: { phoneCode: string; phoneNumber: string; type: string }[];
    emails: { address: string; type: string }[];
    companyType?: any;
    industry?: any;
    description?: string;
    gstNumber?: string;
    campaign?: string;
    source?: any;
    subSource?: any;
    relationshipType: 'Developer' | 'Land Owner' | 'Channel Partner' | 'Vendor' | 'Institutional Owner' | 'Other';
    isPreferredPartner?: boolean;
    createdAt?: string;
}

export const getCompanies = async (params?: Record<string, string>) => {
    const res = await api.get("/companies", { params: { limit: "200", ...params } });
    return res.data;
};

export const getCompanyById = async (id: string) => {
    const res = await api.get(`/companies/${id}`);
    return res.data;
};
