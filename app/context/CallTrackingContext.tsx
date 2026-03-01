import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getActivities } from '../services/activities.service';
import { safeApiCall, extractList } from '../services/api.helpers';
import { lookupCallerInfo, CallerInfo } from '../services/contacts.service';
import CallBanner from '../components/CallBanner';

interface CallTrackingContextType {
    trackCall: (mobile: string, entityId: string, entityType: string, entityName: string) => void;
    simulateIncomingCall: (mobile: string) => void;
}

const CallTrackingContext = createContext<CallTrackingContextType | undefined>(undefined);

export function CallTrackingProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [activeBanner, setActiveBanner] = useState<CallerInfo | null>(null);
    const [lastCall, setLastCall] = useState<{
        mobile: string;
        entityId: string;
        entityType: string;
        entityName: string;
        startTime: number;
    } | null>(null);

    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // User returned to app
                handleAppReturn();
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [lastCall]);

    const handleIncomingCall = async (mobile: string) => {
        const info = await lookupCallerInfo(mobile);
        if (info) {
            // Check for pending activities for this entity to show in banner
            const activityRes = await safeApiCall(() => getActivities({
                entityId: info.entityId,
                status: 'Pending',
                limit: '1'
            }));
            const pending = extractList(activityRes.data);
            if (pending.length > 0) {
                info.activity = `Next: ${pending[0].title || pending[0].type}`;
            }
            setActiveBanner(info);
        }
    };

    const simulateIncomingCall = (mobile: string) => {
        handleIncomingCall(mobile);
    };

    const handleAppReturn = async () => {
        if (!lastCall) return;

        const timeSinceCall = Date.now() - lastCall.startTime;
        // If they return within 2 hours, ask to log
        if (timeSinceCall < 2 * 60 * 60 * 1000) {
            // Fetch pending activities for this entity
            const activityRes = await safeApiCall(() => getActivities({
                entityId: lastCall.entityId,
                status: 'Pending',
                type: 'Call'
            }));
            const pendingActivities = extractList(activityRes.data);

            if (pendingActivities.length > 0) {
                Alert.alert(
                    "Call Finished",
                    `Would you like to log the outcome of your call with ${lastCall.entityName}?`,
                    [
                        { text: "Not Now", onPress: () => setLastCall(null), style: "cancel" },
                        {
                            text: "Log Outcome",
                            onPress: () => {
                                setLastCall(null);
                                router.push({
                                    pathname: "/outcome",
                                    params: {
                                        id: pendingActivities[0]._id,
                                        entityId: lastCall.entityId,
                                        entityType: lastCall.entityType,
                                        entityName: lastCall.entityName,
                                        actType: 'Call',
                                        mobile: lastCall.mobile
                                    }
                                });
                            }
                        }
                    ]
                );
            } else {
                Alert.alert(
                    "Call Finished",
                    `Log results for ${lastCall.entityName}?`,
                    [
                        { text: "No", onPress: () => setLastCall(null), style: "cancel" },
                        {
                            text: "Log Now",
                            onPress: () => {
                                setLastCall(null);
                                router.push({
                                    pathname: "/outcome",
                                    params: {
                                        id: 'new',
                                        entityId: lastCall.entityId,
                                        entityType: lastCall.entityType,
                                        entityName: lastCall.entityName,
                                        actType: 'Call',
                                        status: 'Completed',
                                        mobile: lastCall.mobile
                                    }
                                });
                            }
                        }
                    ]
                );
            }
        } else {
            setLastCall(null);
        }
    };

    const trackCall = (mobile: string, entityId: string, entityType: string, entityName: string) => {
        setLastCall({
            mobile,
            entityId,
            entityType,
            entityName,
            startTime: Date.now()
        });
        Linking.openURL(`tel:${mobile}`);
    };

    return (
        <CallTrackingContext.Provider value={{ trackCall, simulateIncomingCall }}>
            {children}
            <CallBanner info={activeBanner} onClose={() => setActiveBanner(null)} />
        </CallTrackingContext.Provider>
    );
}

export const useCallTracking = () => {
    const context = useContext(CallTrackingContext);
    if (!context) throw new Error('useCallTracking must be used within CallTrackingProvider');
    return context;
};
