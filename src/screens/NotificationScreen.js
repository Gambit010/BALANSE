import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { getUserNotifications, markAsRead } from '../services/notificationService';

const formatTimeAgo = (firebaseTimestamp) => {
  if (!firebaseTimestamp) return '';
  const date = firebaseTimestamp.toDate ? firebaseTimestamp.toDate() : new Date(firebaseTimestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const data = await getUserNotifications(currentUser.uid);
      // Sort by date — newest first
      const sorted = data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setNotifications(sorted);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notifId) => {
    await markAsRead(notifId);
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, isRead: true } : n)
    );
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(unread.map(n => markAsRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'deadline': return { name: 'calendar-outline', color: '#fb923c' };
      case 'conflict': return { name: 'warning-outline', color: '#ef4444' };
      case 'wellness': return { name: 'heart-outline', color: '#34d399' };
      case 'assignment': return { name: 'person-add-outline', color: '#60a5fa' };
      default: return { name: 'notifications-outline', color: '#a78bfa' };
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {/* UNREAD COUNT */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Ionicons name="ellipse" size={8} color="#a78bfa" />
            <Text style={styles.unreadText}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* EMPTY STATE */}
        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={56} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              Deadline alerts and wellness reminders will appear here
            </Text>
          </View>
        )}

        {/* NOTIFICATION LIST */}
        {notifications.map((notif) => {
          const icon = getNotifIcon(notif.type);
          return (
            <TouchableOpacity
              key={notif.id}
              style={[
                styles.notifCard,
                !notif.isRead && styles.notifCardUnread,
              ]}
              onPress={() => handleMarkAsRead(notif.id)}
            >
              <View style={[styles.notifIcon, { backgroundColor: `${icon.color}20` }]}>
                <Ionicons name={icon.name} size={20} color={icon.color} />
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifMessage}>{notif.message}</Text>
                <View style={styles.notifMeta}>
                  <Text style={styles.notifType}>{notif.type}</Text>
                  {notif.createdAt && (
                    <Text style={styles.notifTime}>{formatTimeAgo(notif.createdAt)}</Text>
                  )}
                </View>
              </View>
              {!notif.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  markAllText: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: '600',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  unreadText: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  notifCardUnread: {
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifMessage: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 4,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifType: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'capitalize',
  },
  notifTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a78bfa',
  },
});