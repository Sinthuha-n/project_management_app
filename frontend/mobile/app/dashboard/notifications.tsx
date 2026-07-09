import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '@/src/api/axios';
import { T } from '@/src/constants/tokens';
import { resolveNotificationRoute } from '@/src/navigation/routes';

type NotificationFilter = 'all' | 'unread' | 'read';

type NotificationItem = {
  id: number;
  message: string;
  type?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

type NotificationFeedResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return 'Unknown';

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return 'Unknown';

  const diffMin = Math.floor((Date.now() - time) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function inferNotificationType(notification: NotificationItem): string {
  if (notification.type?.trim()) return notification.type.trim().toUpperCase();

  const message = notification.message.toLowerCase();
  const link = (notification.link || '').toLowerCase();

  if (message.includes('mention')) return 'MENTION';
  if (link.includes('/chat') || message.includes('chat')) return 'CHAT';
  if (message.includes('task') || link.includes('/task')) return 'TASK';
  if (message.includes('page') || link.includes('/pages')) return 'PAGE';
  if (message.includes('project') || link.includes('/project')) return 'PROJECT';

  return 'GENERAL';
}

function typeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'CHAT':
      return 'chatbubbles-outline';
    case 'MENTION':
      return 'at-outline';
    case 'TASK':
      return 'checkbox-outline';
    case 'PAGE':
      return 'document-text-outline';
    case 'PROJECT':
      return 'folder-outline';
    default:
      return 'notifications-outline';
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'CHAT':
      return '#4F46E5';
    case 'MENTION':
      return '#D97706';
    case 'TASK':
      return T.primary;
    case 'PAGE':
      return '#7C3AED';
    case 'PROJECT':
      return '#0891B2';
    default:
      return '#64748B';
  }
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (notification: NotificationItem) => void;
}) {
  const type = inferNotificationType(item);
  const color = typeColor(type);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        !item.read && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={typeIcon(type)} size={20} color={color} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.typeText, { color }]}>{type}</Text>
          <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Text style={[styles.messageText, !item.read && styles.messageUnread]} numberOfLines={3}>
          {item.message}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function DashboardNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const { data } = await api.get<NotificationFeedResponse>('/api/notifications');
      const sorted = [...(data.notifications || [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(sorted);
      setUnreadCount(data.unreadCount || sorted.filter((item) => !item.read).length);
    } catch {
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((item) => !item.read);
    if (filter === 'read') return notifications.filter((item) => item.read);
    return notifications;
  }, [filter, notifications]);

  const readCount = Math.max(0, notifications.length - unreadCount);

  const markAsRead = useCallback(async (notification: NotificationItem) => {
    if (!notification.read) {
      setNotifications((items) =>
        items.map((item) => item.id === notification.id ? { ...item, read: true } : item)
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      try {
        await api.patch(`/api/notifications/${notification.id}/read`);
      } catch {
        void loadNotifications(true);
      }
    }

    const route = resolveNotificationRoute(notification);
    if (route) {
      router.push(route as never);
    }
  }, [loadNotifications, router]);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await api.patch('/api/notifications/read-all');
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }, [notifications, unreadCount]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Dashboard</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <Pressable
          onPress={() => void markAllAsRead()}
          disabled={unreadCount === 0}
          style={[styles.readAllButton, unreadCount === 0 && styles.readAllDisabled]}
        >
          <Ionicons name="checkmark-done" size={18} color={unreadCount === 0 ? '#94A3B8' : T.primary} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.unreadValue]}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{readCount}</Text>
          <Text style={styles.statLabel}>Read</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterButton, active && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
      >
        {loading && notifications.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={T.primary} />
          </View>
        ) : error ? (
          <Pressable onPress={() => loadNotifications()} style={styles.emptyState}>
            <Ionicons name="warning-outline" size={28} color="#EF4444" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Text style={styles.emptyText}>Tap to retry.</Text>
          </Pressable>
        ) : visibleNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' ? 'New activity will appear here.' : `No ${filter} notifications found.`}
            </Text>
          </View>
        ) : (
          visibleNotifications.map((item) => (
            <NotificationRow key={item.id} item={item} onPress={(notification) => void markAsRead(notification)} />
          ))
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 3,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0,
  },
  readAllButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,93,252,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(21,93,252,0.18)',
  },
  readAllDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  statCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    justifyContent: 'center',
  },
  statValue: {
    color: '#0F172A',
    fontSize: 21,
    fontWeight: '800',
  },
  unreadValue: {
    color: T.primary,
  },
  statLabel: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  filterButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: T.primary,
  },
  filterText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  rowUnread: {
    borderColor: 'rgba(21,93,252,0.3)',
    backgroundColor: '#F8FBFF',
  },
  rowPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  messageText: {
    marginTop: 5,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  messageUnread: {
    color: '#0F172A',
    fontWeight: '700',
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.primary,
  },
  centerState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    minHeight: 260,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 5,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  bottomPad: {
    height: 104,
  },
});
