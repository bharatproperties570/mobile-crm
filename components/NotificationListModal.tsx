import React from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  FlatList, ActivityIndicator, Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';

interface NotificationListModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationListModal: React.FC<NotificationListModalProps> = ({ visible, onClose }) => {
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { theme } = useTheme();
  const router = useRouter();

  const handleNotificationPress = (notification: any) => {
    markAsRead(notification._id);
    onClose();
    if (notification.metadata?.entityId && notification.metadata?.entityType) {
        const type = notification.metadata.entityType.toLowerCase();
        const id = notification.metadata.entityId;
        if (type === 'lead') {
            router.push({ pathname: '/lead-detail', params: { id } });
        } else if (type === 'contact') {
            router.push({ pathname: '/contact-detail', params: { id } });
        } else if (type === 'deal') {
            router.push({ pathname: '/deal-detail', params: { id } });
        } else if (type === 'activity') {
            // Check if it's app/activity/[id].tsx
            router.push(`/activity/${id}` as any);
        }
    } else if (notification.link) {
      const link = notification.link.toLowerCase();
      if (link.includes('/leads')) {
        const id = link.split('/').pop();
        if (id && id !== 'leads') router.push({ pathname: '/lead-detail', params: { id } });
        else router.push('/(tabs)/leads' as any);
      } else if (link.includes('/contacts')) {
        const id = link.split('/').pop();
        if (id && id !== 'contacts') router.push({ pathname: '/contact-detail', params: { id } });
        else router.push('/(tabs)/contacts' as any);
      } else if (link.includes('/activities')) {
        const id = link.split('/').pop();
        if (id && id !== 'activities' && id !== '') router.push(`/activity/${id}` as any);
        else router.push('/(tabs)/activities' as any);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <Pressable style={[styles.content, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.title, { color: theme.text }]}>Intelligence Center</Text>
                {unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={markAllAsRead}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {loading && notifications.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.background }]}>
                  <Ionicons name="notifications-off-outline" size={32} color={theme.textMuted} />
                </View>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>System clean. No new alerts.</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[
                        styles.notificationItem, 
                        { borderBottomColor: theme.border }, 
                        !item.isRead && { borderLeftWidth: 3, borderLeftColor: theme.primary, backgroundColor: theme.primary + '05' }
                    ]}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View style={styles.notificationContent}>
                      <View style={styles.notifHeaderRow}>
                         <Text style={[styles.notificationTitle, { color: theme.text }, !item.isRead && { fontWeight: '800' }]}>{item.title}</Text>
                         {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                      </View>
                      <Text style={[styles.notificationMessage, { color: theme.textSecondary }]} numberOfLines={2}>{item.message}</Text>
                      <View style={styles.footerRow}>
                         <Ionicons name="time-outline" size={10} color={theme.textLight} />
                         <Text style={[styles.notificationTime, { color: theme.textLight }]}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.createdAt).toLocaleDateString()}
                         </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}

            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
              <Text style={styles.closeBtnText}>CLOSE CONSOLE</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    borderWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationItem: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  notificationContent: {
    flex: 1,
  },
  notifHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
  },
  unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 15,
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
