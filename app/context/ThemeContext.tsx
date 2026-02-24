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
        background: '#0F172A',
        card: '#1E293B',
        cardBg: '#1E293B',
        text: '#F8FAFC',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        textLight: '#64748B',
        border: '#334155',
        borderStrong: '#475569',
        primary: '#3B82F6',
        primaryLight: '#1E3A8A',
        accent: '#1E293B',
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        error: '#F87171',
        inputBg: '#1E293B',
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
