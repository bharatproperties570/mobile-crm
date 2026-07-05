import { DeviceEventEmitter } from 'react-native';

export const SyncEvents = {
    ACTIVITY_COMPLETED: 'activity-completed',
    LEAD_UPDATED: 'lead-updated',
    CONTACT_UPDATED: 'contact-updated',
    DEAL_UPDATED: 'deal-updated',
    INVENTORY_UPDATED: 'inventory-updated',
    NOTE_ADDED: 'note-added'
};

export const emitSyncEvent = (event: any, detail: any = {}) => {
    console.log(`[Sync] Emitting event: ${event}`, detail);
    DeviceEventEmitter.emit(event, detail);
};

export const useSyncListener = (events: any, callback: any) => {
    const eventArray = Array.isArray(events) ? events : [events];
    
    eventArray.forEach(event => {
        DeviceEventEmitter.addListener(event, (detail) => {
            console.log(`[Sync] Event received: ${event}`, detail);
            callback(event, detail);
        });
    });

    return () => {
        eventArray.forEach(event => {
            DeviceEventEmitter.removeAllListeners(event);
        });
    };
};
