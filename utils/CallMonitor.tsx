import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { getLeads } from '../services/leads.service';
import CallSyncService from '../services/CallSyncService';

let CallKeep: any = null;
try {
    // CallKeep only works on Android for this implementation, 
    // and requires native linking (not Expo Go)
    const Module = require('react-native-callkeep');
    CallKeep = Module.default || Module;
} catch (e) {
    console.warn('[CallMonitor] Native CallKeep module not available.');
}

/**
 * Enterprise Call Monitor
 * Handles incoming call detection and "Truecaller" style identification.
 * Note: Requires custom dev client build on Android for background execution.
 */
export const useCallMonitor = () => {
    useEffect(() => {
        if (Platform.OS !== 'android' || !CallKeep) return;

        const setupCallKeep = async () => {
            try {
                if (!CallKeep.setup) return;
                await CallKeep.setup({
                    ios: { appName: 'Bharat Properties' },
                    android: {
                        alertTitle: 'Permissions required',
                        alertDescription: 'This app needs access to your phone state to identify leads.',
                        cancelButton: 'Cancel',
                        okButton: 'ok',
                        selfManaged: false,
                    }
                });

                // Listen for incoming calls
                if (CallKeep.addEventListener) {
                    CallKeep.addEventListener('didReceiveStartCallAction', async ({ handle }: any) => {
                        console.log('[CallMonitor] Incoming call from:', handle);
                        identifyCaller(handle);
                    });
                }

                // Periodic Sync
                const interval = setInterval(() => {
                    CallSyncService.syncLogs();
                }, 15 * 60 * 1000); // Every 15 mins

                return () => {
                    clearInterval(interval);
                    if (CallKeep?.removeEventListener) {
                        CallKeep.removeEventListener('didReceiveStartCallAction');
                    }
                };
            } catch (e) {
                console.error('[CallMonitor] Setup failed:', e);
            }
        };

        setupCallKeep();
    }, []);

    const identifyCaller = async (phoneNumber: string) => {
        try {
            // Normalize number (remove +91, spaces)
            const clean = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
            
            // Fast lookup in CRM
            const leadsRes = await getLeads({ search: clean, limit: 1 });
            const leads = leadsRes?.data ?? leadsRes;

            if (Array.isArray(leads) && leads.length > 0) {
                const lead = leads[0];
                console.log(`[CallMonitor] Identified Lead: ${lead.firstName} ${lead.lastName}`);
                
                // Show Banner (Truecaller style Alert)
                // In a real production app, we would use react-native-system-alert-window 
                // but for this MVP, a High-Priority Alert or Modal is used.
                Alert.alert(
                    "📞 Lead Calling!",
                    `Name: ${lead.firstName} ${lead.lastName}\nStatus: ${lead.status?.lookup_value || 'Active'}\nRequirement: ${lead.requirement?.lookup_value || 'N/A'}`,
                    [{ text: "Open CRM", onPress: () => console.log('Open Lead Detail') }, { text: "Dismiss" }],
                    { cancelable: true }
                );
            }
        } catch (e) {
            console.error('[CallMonitor] Identification error:', e);
        }
    };
};
