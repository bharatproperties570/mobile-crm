import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';

export const requestCalendarPermissions = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
};

export const findOrCreateCRMCAL = async () => {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const existing = calendars.find(c => c.title === 'Bharat Properties CRM');

    if (existing) return existing.id;

    if (Platform.OS === 'ios') {
        const source = (await Calendar.getSourcesAsync()).find(s => s.type === 'local') || (await Calendar.getSourcesAsync())[0];
        return await Calendar.createCalendarAsync({
            title: 'Bharat Properties CRM',
            color: '#1E40AF',
            entityType: Calendar.EntityTypes.EVENT,
            sourceId: source.id,
            source: source,
            name: 'bharat_crm',
            ownerAccount: 'personal',
            accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });
    } else {
        return await Calendar.createCalendarAsync({
            title: 'Bharat Properties CRM',
            color: '#1E40AF',
            entityType: Calendar.EntityTypes.EVENT,
            name: 'bharat_crm',
            ownerAccount: 'personal',
            accessLevel: Calendar.CalendarAccessLevel.OWNER,
            source: {
                isLocalAccount: true,
                name: 'Bharat CRM',
                type: 'LOCAL'
            }
        });
    }
};

export const syncActivityToCalendar = async (activity: any) => {
    try {
        const granted = await requestCalendarPermissions();
        if (!granted) {
            Alert.alert("Permission Denied", "Calendar access is required to sync activities.");
            return;
        }

        const calendarId = await findOrCreateCRMCAL();

        const startDate = new Date(`${activity.dueDate}T${activity.dueTime}:00`);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // Default 30 mins

        await Calendar.createEventAsync(calendarId, {
            title: `[CRM] ${activity.subject}`,
            startDate,
            endDate,
            notes: activity.description,
            location: activity.details?.meetingLocation || '',
            alarms: [{ relativeOffset: -15 }], // 15 min reminder
        });

        return true;
    } catch (e) {
        console.error("Calendar sync failed", e);
        return false;
    }
};
