import api from "./api";

export interface ProjectBlock {
    name: string;
    floors?: string;
    units?: string;
    status?: string;
    landArea?: string;
    landAreaUnit?: string;
    parkingType?: string;
    launchDate?: string;
    expectedCompletionDate?: string;
    possessionDate?: string;
}

export interface Project {
    _id: string;
    name: string;
    developerId?: string;
    developerName?: string;
    isJointVenture?: boolean;
    secondaryDeveloper?: string;
    reraNumber?: string;
    description?: string;
    category?: any[];
    subCategory?: any[];
    landArea?: string;
    landAreaUnit?: string;
    totalBlocks?: string;
    totalFloors?: string;
    totalUnits?: string;
    status?: any;
    launchDate?: string;
    expectedCompletionDate?: string;
    possessionDate?: string;
    parkingType?: any;
    unitType?: any;
    approvedBank?: string;
    owner?: any;
    assign?: any[];
    team?: any[];
    visibleTo?: string;
    locationSearch?: string;
    latitude?: string;
    longitude?: string;
    address?: {
        hNo?: string;
        street?: string;
        locality?: string;
        location?: string;
        area?: string;
        country?: string;
        state?: string;
        city?: string;
        tehsil?: string;
        postOffice?: string;
        pincode?: string;
    };
    projectDocuments?: any[];
    projectImages?: any[];
    projectVideos?: any[];
    amenities?: Record<string, boolean>;
    blocks?: ProjectBlock[];
    pricing?: any;
    createdAt?: string;
    updatedAt?: string;
}

export const getProjects = async () => {
    const res = await api.get("/projects");
    return res.data;
};

export const createProject = async (data: Partial<Project>) => {
    const res = await api.post("/projects", data);
    return res.data;
};

export const updateProject = async (id: string, data: Partial<Project>) => {
    const res = await api.put(`/projects/${id}`, data);
    return res.data;
};

export const getProjectById = async (id: string) => {
    const res = await api.get(`/projects/${id}`);
    return res.data;
};

export const deleteProject = async (id: string) => {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
};
