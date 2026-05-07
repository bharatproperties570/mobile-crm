import api from "./api";

export interface CompanyGroup {
    _id: string;
    name: string;
    description?: string;
    category: string;
    color: string;
    isSystem: boolean;
    createdAt: string;
}

export const getCompanyGroups = async () => {
    return api.get("/company-groups");
};

export const createCompanyGroup = async (data: Partial<CompanyGroup>) => {
    return api.post("/company-groups", data);
};

export const updateCompanyGroup = async (id: string, data: Partial<CompanyGroup>) => {
    return api.put(`/company-groups/${id}`, data);
};

export const deleteCompanyGroup = async (id: string) => {
    return api.delete(`/company-groups/${id}`);
};

export const bulkAssignCompanies = async (companyIds: string[], groupIds: string[], action: 'add' | 'remove') => {
    return api.post("/company-groups/bulk-assign", { companyIds, groupIds, action });
};
