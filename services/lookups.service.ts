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
    if (parentId && parentId !== "undefined") params.parent_lookup_id = parentId;
    const res = await api.get("/lookups", { params });
    return res.data;
};

export const getHierarchicalDocs = async () => {
    try {
        const res = await api.get("/lookups", { params: { limit: 2000 } });
        const allLookups = res.data?.data || (Array.isArray(res.data) ? res.data : []);

        const categories = allLookups.filter((item: any) =>
            item.lookup_type === 'Document-Category' || item.lookup_type === 'DocumentCategory'
        );

        const hierarchy: any = {};

        categories.forEach((cat: any) => {
            const types = allLookups.filter((item: any) =>
                (item.lookup_type === 'Document-Type' || item.lookup_type === 'DocumentType') &&
                (item.parent_lookup_id === cat._id || item.parent_lookup_id?._id === cat._id ||
                    item.parent_lookup_value === cat.lookup_value)
            );

            if (hierarchy[cat.lookup_value]) {
                const existingSubNames = new Set(hierarchy[cat.lookup_value].subCategories.map((s: any) => s.lookup_value));
                types.forEach((t: any) => {
                    if (!existingSubNames.has(t.lookup_value)) {
                        hierarchy[cat.lookup_value].subCategories.push(t);
                    }
                });
            } else {
                hierarchy[cat.lookup_value] = {
                    ...cat,
                    subCategories: types
                };
            }
        });

        return { status: 'success', data: Object.values(hierarchy) };
    } catch (error) {
        console.error("Failed to build doc hierarchy:", error);
        return { status: 'error', data: [] };
    }
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
