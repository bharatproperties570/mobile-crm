import api from "./api";

export interface SystemSetting {
    _id: string;
    key: string;
    value: any;
    category: string;
    isPublic: boolean;
}

export const getSystemSettings = async () => {
    const res = await api.get("/system-settings");
    return res.data;
};

export const getSystemSettingsByKey = async (key: string) => {
    const res = await api.get(`/system-settings/${key}`);
    return res.data;
};

export const upsertSystemSetting = async (key: string, data: any) => {
    const res = await api.post("/system-settings/upsert", { key, ...data });
    return res.data;
};
