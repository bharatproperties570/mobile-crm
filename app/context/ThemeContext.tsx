import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../services/storage';

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    theme: typeof Colors.light | typeof Colors.dark;
}

export const Colors = {
    light: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
        textMuted: '#64748B',
        textLight: '#94A3B8',
        border: '#F1F5F9',
        borderStrong: '#E2E8F0',
        primary: '#2563EB',
        accent: '#EEF2FF',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
    },
    dark: {
        background: '#0F172A',
        card: '#1E293B',
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        textLight: '#64748B',
        border: '#334155',
        borderStrong: '#475569',
        primary: '#3B82F6',
        accent: '#1E293B',
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
    }
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
