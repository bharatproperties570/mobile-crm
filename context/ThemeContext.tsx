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
        glassBg: 'rgba(255, 255, 255, 0.85)',
        glassBorder: 'rgba(255, 255, 255, 0.6)',
        text: '#0F172A',
        textPrimary: '#1E293B',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        textLight: '#94A3B8',
        border: '#F1F5F9',
        borderStrong: '#E2E8F0',
        primary: '#1DB954',    // Spotify Green (Applied to Light Mode too for consistency)
        primaryLight: '#DCFCE7',
        accent: '#EEF2FF',
        success: '#1DB954',
        warning: '#F59E0B',
        danger: '#EF4444',
        error: '#EF4444',
        inputBg: '#F1F5F9',
    },
    dark: {
        background: '#121212', // Spotify Main Black
        card: '#181818',       // Spotify Card Surface
        cardBg: '#181818',
        glassBg: 'rgba(24, 24, 24, 0.8)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        text: '#FFFFFF',       // High Contrast White
        textPrimary: '#FFFFFF',
        textSecondary: '#D1D1D1', // Brighter secondary text for better readability
        textMuted: '#A0A0A0',     // Clearer muted text
        textLight: '#808080',     // Visible light text for details
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(255, 255, 255, 0.15)',
        primary: '#1DB954',    // Spotify Green
        primaryLight: 'rgba(29, 185, 84, 0.15)',
        accent: '#282828',
        success: '#1DB954',
        warning: '#F59E0B',
        danger: '#E91429',     // Spotify Vibrant Red
        error: '#E91429',
        inputBg: '#282828',
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
