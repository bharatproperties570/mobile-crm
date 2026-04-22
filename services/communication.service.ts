import api from "./api";

export const getEmails = async (params: any = {}) => {
    const res = await api.get("/email/inbox", { params });
    return res.data;
};

export const getAiConversations = async () => {
    const res = await api.get("/conversations/active");
    return res.data;
};

export const updateAiConversationStatus = async (id: string, status: string) => {
    const res = await api.put(`/conversations/${id}/status`, { status });
    return res.data;
};

export const convertEmailToLead = async (uid: string) => {
    const res = await api.post(`/email/convert-to-lead`, { uid });
    return res.data;
};

export const getOAuthUrl = async () => {
    const res = await api.get("/email/oauth-url");
    return res.data;
};
