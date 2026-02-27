import api from "./api";

export interface Lookup {
    _id: string;
    lookup_type: string;
    lookup_value: string;
    description?: string;
    parent_id?: string;
}

export const getLookups = async (type?: string, parentId?: string) => {
    const params: any = { limit: 1000 };
    if (type) params.lookup_type = type;
    if (parentId) params.parent_lookup_id = parentId;
    const res = await api.get("/lookups", { params });
    return res.data;
};

// Common types for leads
export const LEAD_LOOKUP_TYPES = [
    "Requirement",
    "SubRequirement",
    "Budget",
    "Source",
    "Status",
    "PropertyType",
    "SubType",
    "UnitType",
    "Facing",
    "RoadWidth",
    "Direction",
    "Campaign",
    "SubCampaign",
    "SubSource",
    "Title",
    "ProjectLocation"
];
