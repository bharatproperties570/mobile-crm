import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Project {
    _id: string;
    id: string;
    name: string;
    address?: {
        city?: string;
        location?: string;
    };
    blocks?: any[];
}

interface ProjectContextType {
    projects: Project[];
    loading: boolean;
    refreshProjects: () => Promise<void>;
    findProject: (id: string) => Project | undefined;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectIndex, setProjectIndex] = useState<Map<string, Project>>(new Map());
    const [loading, setLoading] = useState(true);

    const refreshProjects = useCallback(async () => {
        // 1. Try cache first
        if (projects.length === 0) {
            try {
                const cached = await AsyncStorage.getItem("@cache_projects");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setProjects(parsed);
                    const index = new Map<string, Project>();
                    parsed.forEach((p: Project) => {
                        if (p._id) index.set(p._id, p);
                        if (p.id) index.set(p.id, p);
                    });
                    setProjectIndex(index);
                    setLoading(false); // Quick UI response
                }
            } catch (e) { console.warn("[ProjectContext] Cache read failed", e); }
        }

        if (projects.length === 0) setLoading(true);

        try {
            const res = await api.get('/projects', { params: { limit: 1000 } });
            const data = res.data?.records || res.data?.data || (Array.isArray(res.data) ? res.data : []);

            if (Array.isArray(data) && data.length > 0) {
                setProjects(data);
                AsyncStorage.setItem("@cache_projects", JSON.stringify(data)).catch(() => {});
                
                const index = new Map<string, Project>();
                data.forEach((p: Project) => {
                    if (p._id) index.set(p._id, p);
                    if (p.id) index.set(p.id, p);
                });
                setProjectIndex(index);
            }
        } catch (error) {
            console.error('[ProjectContext] Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    }, [projects.length]);

    useEffect(() => {
        refreshProjects();
    }, [refreshProjects]);

    const findProject = useCallback((id: string) => {
        return projectIndex.get(id);
    }, [projectIndex]);

    return (
        <ProjectContext.Provider value={{ projects, loading, refreshProjects, findProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProjects = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectProvider');
    }
    return context;
};
