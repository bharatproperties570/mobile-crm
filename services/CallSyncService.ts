import { PermissionsAndroid, Platform } from 'react-native';
import api from './api';
import * as SecureStore from 'expo-secure-store';

let CallLog: any = null;
try {
    if (Platform.OS === 'android') {
        CallLog = require('react-native-call-log');
    }
} catch (e) {
    console.warn('[CallSync] Native call-log module not available. This is normal in Expo Go.');
}

export interface MobileCall {
    id: string;
    number: string;
    type: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'UNKNOWN';
    duration: number;
    timestamp: number;
    name?: string;
}

class CallSyncService {
    private static instance: CallSyncService;
    private isSyncing: boolean = false;

    private constructor() {}

    public static getInstance(): CallSyncService {
        if (!CallSyncService.instance) {
            CallSyncService.instance = new CallSyncService();
        }
        return CallSyncService.instance;
    }

    /**
     * Request necessary permissions for call log access on Android.
     */
    public async requestPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;

        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
                PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
            ]);

            return (
                granted['android.permission.READ_CALL_LOG'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.READ_PHONE_STATE'] === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch (err) {
            console.error('[CallSync] Permission error:', err);
            return false;
        }
    }

    /**
     * Fetch call logs from the device and sync to the server.
     */
    public async syncLogs(): Promise<{ success: boolean; count: number; error?: string }> {
        if (this.isSyncing) return { success: false, count: 0, error: 'Sync already in progress' };
        
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) return { success: false, count: 0, error: 'Permission denied' };

        if (!CallLog) {
            console.warn('[CallSync] Skipping sync: CallLog module not linked.');
            return { success: false, count: 0, error: 'Module not linked' };
        }

        this.isSyncing = true;
        console.log('[CallSync] 🚀 Starting Call Log Sync...');

        try {
            // 1. Get last sync timestamp to avoid duplicates if possible, 
            // though backend handles mobileId deduplication.
            const lastSync = await SecureStore.getItemAsync('last_call_sync_ts') || '0';
            
            // 2. Fetch logs from device (Limit to last 100 for performance)
            const logs = await CallLog.load(100);
            
            if (!logs || logs.length === 0) {
                this.isSyncing = false;
                return { success: true, count: 0 };
            }

            // 3. Map to backend schema
            const calls = logs.map((log: any) => ({
                id: `${log.phoneNumber}_${log.dateTime}`,
                number: log.phoneNumber,
                type: log.type.toUpperCase(), // INCOMING, OUTGOING, MISSED
                duration: parseInt(log.duration),
                timestamp: parseInt(log.dateTime),
                name: log.name || null
            }));

            // 4. Send to backend
            const response = await api.post('/activities/mobile-sync', { calls, messages: [] });

            if (response.data.success) {
                const now = Date.now().toString();
                await SecureStore.setItemAsync('last_call_sync_ts', now);
                console.log(`[CallSync] ✅ Successfully synced ${calls.length} calls.`);
                this.isSyncing = false;
                return { success: true, count: calls.length };
            } else {
                throw new Error(response.data.error || 'Backend failed');
            }

        } catch (err: any) {
            console.error('[CallSync] ❌ Sync failed:', err.message);
            this.isSyncing = false;
            return { success: false, count: 0, error: err.message };
        }
    }
}

export default CallSyncService.getInstance();
