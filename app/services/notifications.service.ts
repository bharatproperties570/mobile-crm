import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
};

export const scheduleActivityReminder = async (activity: any) => {
    try {
        const granted = await requestNotificationPermissions();
        if (!granted) return false;

        const trigger = new Date(`${activity.dueDate}T${activity.dueTime}:00`);
        // Schedule 15 minutes before
        const reminderTime = new Date(trigger.getTime() - 15 * 60000);

        if (reminderTime < new Date()) return false;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: `Reminder: ${activity.type}`,
                body: activity.subject,
                data: { id: activity._id },
            },
            trigger: reminderTime,
        });

        return true;
    } catch (e) {
        console.error("Failed to schedule notification", e);
        return false;
    }
};

export const cancelAllReminders = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
};
