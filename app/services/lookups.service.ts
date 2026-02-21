import api from "./api";

export interface Lookup {
    _id: string;
    lookup_type: string;
    lookup_value: string;
    description?: string;
    parent_id?: string;
}

export const getLookups = async (type?: string) => {
    const params = type ? { lookup_type: type, limit: 1000 } : { limit: 1000 };
    const res = await api.get("/lookups", { params });
    return res.data;
};

// Common types for leads
export const LEAD_LOOKUP_TYPES = [
    "Requirement",
    "Sub Requirement",
    "Budget",
    "Source",
    "Status",
    "Property Type",
    "Sub Type",
    "Unit Type",
    "Facing",
    "Road Width",
    "Direction",
    "Campaign",
    "Sub Campaign",
    "SubSource",
    "Title",
    "Project Location"
];
