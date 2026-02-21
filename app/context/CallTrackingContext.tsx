import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getActivities } from '../services/activities.service';
import { safeApiCall, extractList } from '../services/api.helpers';

interface CallTrackingContextType {
    trackCall: (mobile: string, entityId: string, entityType: string, entityName: string) => void;
}

const CallTrackingContext = createContext<CallTrackingContextType | undefined>(undefined);

export function CallTrackingProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
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

    const handleAppReturn = async () => {
        if (!lastCall) return;

        const timeSinceCall = Date.now() - lastCall.startTime;
        // If they return within 2 hours, ask to log
        if (timeSinceCall < 2 * 60 * 60 * 1000) {

            // Optional: Fetch pending activities for this entity to see if there's an existing one to complete
            const activityRes = await safeApiCall(() => getActivities({
                entityId: lastCall.entityId,
                status: 'Pending',
                type: 'Call'
            }));
            const pendingActivities = extractList(activityRes.data);

            if (pendingActivities.length > 0) {
                // Logic to select which activity to complete or create new
                Alert.alert(
                    "Call Finished",
                    `Would you like to log the outcome of your call with ${lastCall.entityName}?`,
                    [
                        { text: "Not Now", onPress: () => setLastCall(null), style: "cancel" },
                        {
                            text: "Log Outcome",
                            onPress: () => {
                                setLastCall(null);
                                // Navigate to completion screen
                                router.push({
                                    pathname: "/complete-activity",
                                    params: {
                                        id: pendingActivities[0]._id,
                                        entityId: lastCall.entityId,
                                        entityType: lastCall.entityType,
                                        entityName: lastCall.entityName,
                                        actType: 'Call'
                                    }
                                });
                            }
                        }
                    ]
                );
            } else {
                // No pending call activity found, offer to create a new completed one
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
                                    pathname: "/add-activity",
                                    params: {
                                        id: lastCall.entityId,
                                        type: lastCall.entityType,
                                        actType: 'Call',
                                        status: 'Completed'
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
        <CallTrackingContext.Provider value={{ trackCall }}>
            {children}
        </CallTrackingContext.Provider>
    );
}

export const useCallTracking = () => {
    const context = useContext(CallTrackingContext);
    if (!context) throw new Error('useCallTracking must be used within CallTrackingProvider');
    return context;
};
