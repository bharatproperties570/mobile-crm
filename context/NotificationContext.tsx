import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  metadata?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Professional Ping Sound
const NOTIF_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const soundRef = useRef<Audio.Sound | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const appState = useRef(AppState.currentState);

  const loadSound = async () => {
    try {
      if (soundRef.current) return;
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckOthers: true,
      });
      const { sound } = await Audio.Sound.createAsync({ uri: NOTIF_SOUND_URL });
      soundRef.current = sound;
    } catch (error) {
      console.warn('Failed to load notification sound', error);
    }
  };

  const playNotificationSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      } else {
        await loadSound();
        await soundRef.current?.playAsync();
      }
    } catch (error) {
      console.warn('Error playing notification sound', error);
    }
  };

  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;
    
    // Skip polling if app is in background
    if (isSilent && appState.current !== 'active') return;

    if (!isSilent) setLoading(true);
    try {
      const res = await api.get('/notifications');
      const responseData = res.data?.success ? res.data.data : res.data;
      
      if (responseData && responseData.notifications) {
        const newNotifs: Notification[] = responseData.notifications;
        const newCount: number = responseData.unreadCount || 0;
        
        // 🔔 Intelligent ID Detection
        const currentIds = newNotifs.map(n => n._id);
        const hasNewArrival = currentIds.some(id => !knownIdsRef.current.has(id));

        if (!isInitialLoad.current && hasNewArrival && newCount > 0) {
          playNotificationSound();
        }
        
        setNotifications(newNotifs);
        setUnreadCount(newCount);
        knownIdsRef.current = new Set(currentIds);
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.warn('[Notifications] Polling failed:', error.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('Failed to mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.warn('Failed to mark all as read', error);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            fetchNotifications(true);
        }
        appState.current = nextAppState;
    });

    if (isAuthenticated) {
      loadSound();
      fetchNotifications();
      const interval = setInterval(() => fetchNotifications(true), 8000); // 8s polling
      
      return () => {
        subscription.remove();
        clearInterval(interval);
        if (soundRef.current) {
            soundRef.current.unloadAsync().catch(() => {});
            soundRef.current = null;
        }
      };
    } else {
        setNotifications([]);
        setUnreadCount(0);
        knownIdsRef.current = new Set();
        isInitialLoad.current = true;
        return () => subscription.remove();
    }
  }, [isAuthenticated, fetchNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAsRead,
      markAllAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
