import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "../services/storage";

export type Department = 'Sales' | 'Inventory' | 'Post-Sales';

interface DeptConfig {
    name: Department;
    color: string;
    bg: string;
    icon: string;
    tabs: { name: string; label: string; icon: string; route: string }[];
}

const DEPARTMENTS: Record<Department, DeptConfig> = {
    'Sales': {
        name: 'Sales',
        color: '#3B82F6', // Blue
        bg: '#EFF6FF',
        icon: 'trending-up',
        tabs: [
            { name: 'index', label: 'Home', icon: 'home', route: '/(tabs)' },
            { name: 'leads', label: 'Leads', icon: 'people', route: '/(tabs)/leads' },
            { name: 'deals', label: 'Deals', icon: 'handshake', route: '/(tabs)/deals' },
            { name: 'projects', label: 'Projects', icon: 'construct', route: '/(tabs)/projects' },
            { name: 'more', label: 'More', icon: 'grid', route: '/(tabs)/more' },
        ]
    },
    'Inventory': {
        name: 'Inventory',
        color: '#F59E0B', // Amber
        bg: '#FFFBEB',
        icon: 'business',
        tabs: [
            { name: 'index', label: 'Home', icon: 'home', route: '/(tabs)' },
            { name: 'companies', label: 'Companies', icon: 'business', route: '/(tabs)/companies' },
            { name: 'inventory', label: 'Units', icon: 'cube', route: '/inventory' },
            { name: 'contacts', label: 'Partners', icon: 'business', route: '/(tabs)/contacts' },
            { name: 'more', label: 'More', icon: 'grid', route: '/(tabs)/more' },
        ]
    },
    'Post-Sales': {
        name: 'Post-Sales',
        color: '#10B981', // Emerald
        bg: '#ECFDF5',
        icon: 'receipt',
        tabs: [
            { name: 'index', label: 'Home', icon: 'home', route: '/(tabs)' },
            { name: 'bookings', label: 'Bookings', icon: 'document-text', route: '/bookings' },
            { name: 'accounts', label: 'Accounts', icon: 'wallet', route: '/accounts' },
            { name: 'more', label: 'More', icon: 'grid', route: '/(tabs)/more' },
        ]
    }
};

interface DepartmentContextType {
    currentDept: Department;
    config: DeptConfig;
    setDepartment: (dept: Department) => void;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: React.ReactNode }) {
    const [currentDept, setCurrentDept] = useState<Department>('Sales');

    useEffect(() => {
        loadDept();
    }, []);

    const loadDept = async () => {
        const saved = await storage.getItem("currentDepartment");
        if (saved && (saved === 'Sales' || saved === 'Inventory' || saved === 'Post-Sales')) {
            setCurrentDept(saved as Department);
        }
    };

    const setDepartment = async (dept: Department) => {
        setCurrentDept(dept);
        await storage.setItem("currentDepartment", dept);
    };

    return (
        <DepartmentContext.Provider value={{ currentDept, config: DEPARTMENTS[currentDept], setDepartment }}>
            {children}
        </DepartmentContext.Provider>
    );
}

export const useDepartment = () => {
    const context = useContext(DepartmentContext);
    if (!context) throw new Error("useDepartment must be used within DepartmentProvider");
    return context;
};
