import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from "@/services/storage";

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    theme: typeof Colors.light | typeof Colors.dark;
}

export const Colors = {
    light: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        cardBg: '#FFFFFF',
        text: '#0F172A',
        textPrimary: '#1E293B',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        textLight: '#94A3B8',
        border: '#F1F5F9',
        borderStrong: '#E2E8F0',
        primary: '#2563EB',
        primaryLight: '#DBEAFE',
        accent: '#EEF2FF',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        error: '#EF4444',
        inputBg: '#F1F5F9',
    },
    dark: {
        background: '#07162B',
        card: '#0D2040',
        cardBg: '#0D2040',
        text: '#EEE8D8',
        textPrimary: '#EEE8D8',
        textSecondary: '#A89E88',
        textMuted: '#6A6255',
        textLight: '#6A6255',
        border: 'rgba(201, 146, 26, 0.15)',
        borderStrong: 'rgba(201, 146, 26, 0.28)',
        primary: '#C9921A',
        primaryLight: '#262010',
        accent: '#0D2040',
        success: '#35B97A',
        warning: '#E0A830',
        danger: '#E05252',
        error: '#E05252',
        inputBg: '#0D2040',
    }
};

export const SPACING = {
    outer: 20,
    card: 24,
    section: 28,
    field: 20,
    inputHeight: 56,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        const saved = await storage.getItem('isDarkMode');
        if (saved !== null) {
            setIsDarkMode(saved === 'true');
        }
    };

    const toggleTheme = async () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        await storage.setItem('isDarkMode', String(newValue));
    };

    const theme = isDarkMode ? Colors.dark : Colors.light;

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};
