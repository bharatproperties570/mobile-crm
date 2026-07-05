import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { getLeads } from '../services/leads.service';
import CallSyncService from '../services/CallSyncService';

let CallKeep: any = null;

/**
 * Enterprise Call Monitor
 * Handles incoming call detection and "Truecaller" style identification.
 * Note: Requires custom dev client build on Android for background execution.
 */
export const useCallMonitor = () => {
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const setupCallKeep = async () => {
            try {
                // Dynamic import to prevent startup crash if module is missing
                if (!CallKeep) {
                    try {
                        const Module = require('react-native-callkeep');
                        CallKeep = Module.default || Module;
                    } catch (e) {
                        console.warn('[CallMonitor] Native CallKeep module not available.');
                        return;
                    }
                }
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

                // Handle sync response to show Alert for pending activities
                const handlePendingResolutions = (res: any) => {
                    if (res?.success && res.pendingResolutions && res.pendingResolutions.length > 0) {
                        const pending = res.pendingResolutions[0];
                        Alert.alert(
                            "📞 Complete Call Activity",
                            `You have a pending Call activity for ${pending.entityName}. Would you like to complete it now?`,
                            [
                                { text: "Skip", style: "cancel" },
                                { text: "Complete", onPress: () => console.log('Navigate to complete activity', pending.activityId) }
                            ]
                        );
                    }
                };

                // Listen for incoming calls
                if (CallKeep.addEventListener) {
                    CallKeep.addEventListener('didReceiveStartCallAction', async ({ handle }: any) => {
                        console.log('[CallMonitor] Incoming call from:', handle);
                        identifyCaller(handle);
                    });
                    CallKeep.addEventListener('endCall', async () => {
                        console.log('[CallMonitor] Call ended, syncing logs...');
                        setTimeout(async () => {
                            const res = await CallSyncService.syncLogs();
                            handlePendingResolutions(res);
                        }, 2000);
                    });
                }

                // Periodic Sync
                const interval = setInterval(async () => {
                    const res = await CallSyncService.syncLogs();
                    handlePendingResolutions(res);
                }, 15 * 60 * 1000); // Every 15 mins

                return () => {
                    clearInterval(interval);
                    if (CallKeep?.removeEventListener) {
                        CallKeep.removeEventListener('didReceiveStartCallAction');
                        CallKeep.removeEventListener('endCall');
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
            const leadsRes = await getLeads({ search: clean, limit: "1" as any });
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
