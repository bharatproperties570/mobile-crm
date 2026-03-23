import * as FileSystem from 'expo-file-system';
const { StorageAccessFramework } = FileSystem as any;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@samsung_recording_folder_uri';

export const requestFolderPermission = async () => {
    if (Platform.OS !== 'android') return null;

    try {
        const permissions = await (StorageAccessFramework as any).requestDirectoryPermissionsAsync();
        if (permissions.granted) {
            await AsyncStorage.setItem(STORAGE_KEY, permissions.directoryUri);
            return permissions.directoryUri;
        }
    } catch (e) {
        console.error('[StorageService] Permission error:', e);
    }
    return null;
};

export const getAuthorizedFolder = async () => {
    return await AsyncStorage.getItem(STORAGE_KEY);
};

export const disconnectFolder = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * Scans the authorized folder for the latest recording matching a timestamp
 * @param windowMinutes How many minutes back to look (default 10)
 * @param searchString Optional string to match in filename (e.g. phone number)
 */
export const findLatestRecording = async (windowMinutes = 10, searchString?: string) => {
    if (Platform.OS !== 'android') return null;

    try {
        const folderUri = await getAuthorizedFolder();
        if (!folderUri) return null;

        const files = await (StorageAccessFramework as any).readDirectoryAsync(folderUri);

        const audioFiles = files.filter((f: string) =>
            f.toLowerCase().endsWith('.m4a') ||
            f.toLowerCase().endsWith('.amr') ||
            f.toLowerCase().endsWith('.mp3')
        );

        if (audioFiles.length === 0) return null;

        const now = Date.now();
        const threshold = windowMinutes * 60 * 1000;
        const matches = [];

        for (const fileUri of audioFiles) {
            const info = await FileSystem.getInfoAsync(fileUri);
            if (info.exists && !info.isDirectory) {
                const mTime = info.modificationTime ? info.modificationTime * 1000 : 0;
                const age = now - mTime;

                if (age > 0 && age < threshold) {
                    const fileName = decodeURIComponent(fileUri.split('%2F').pop() || '');
                    matches.push({
                        uri: fileUri,
                        name: fileName,
                        mTime: mTime,
                        age: age
                    });
                }
            }
        }

        if (matches.length === 0) return null;

        // 1. Try to find an exact match for the searchString (mobile number)
        if (searchString) {
            const cleanSearch = searchString.replace(/\D/g, '');
            if (cleanSearch.length >= 10) {
                const exactMatch = matches.find(m => m.name.includes(cleanSearch));
                if (exactMatch) return { ...exactMatch, exact: true };
            }
        }

        // 2. Fallback to newest in window
        matches.sort((a, b) => b.mTime - a.mTime);
        return { ...matches[0], exact: false };
    } catch (e) {
        console.error('[StorageService] Scan error:', e);
        return null;
    }
};
