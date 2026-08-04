import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { StateView } from '@/src/components/ui/StateView';

type ChatInboxActivity = {
  projectId: number;
  projectName: string;
  chatType: 'TEAM' | 'ROOM' | 'DIRECT';
  roomId?: number | null;
  roomName?: string | null;
  username?: string | null;
  participantLabel?: string | null;
  lastMessage?: string | null;
  lastMessageSender?: string | null;
  lastMessageTimestamp?: string | null;
  unseenCount: number;
  unread: boolean;
};

type ChatInboxResponse = {
  recentActivities: ChatInboxActivity[];
  totalUnread: number;
};

function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'No messages';

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

function getActivityTitle(activity: ChatInboxActivity): string {
  if (activity.chatType === 'TEAM') return 'Team Chat';
  if (activity.chatType === 'ROOM') return activity.roomName || 'Channel';
  return activity.participantLabel || activity.username || 'Direct Message';
}

function getActivityIcon(activity: ChatInboxActivity): keyof typeof Ionicons.glyphMap {
  if (activity.chatType === 'TEAM') return 'people-outline';
  if (activity.chatType === 'ROOM') return 'chatbubbles-outline';
  return 'person-circle-outline';
}

function buildChatRoute(activity: ChatInboxActivity): string {
  const base = `/(project)/${activity.projectId}/chat`;
  if (activity.chatType === 'ROOM' && activity.roomId) {
    return `${base}?roomId=${activity.roomId}`;
  }
  if (activity.chatType === 'DIRECT' && activity.username) {
    return `${base}?with=${encodeURIComponent(activity.username)}`;
  }
  return `${base}?view=team`;
}

function InboxRow({ activity }: { activity: ChatInboxActivity }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${getActivityTitle(activity)} in ${activity.projectName}${activity.unread ? `, ${activity.unseenCount} unread` : ''}`}
      onPress={() => router.push(buildChatRoute(activity) as never)}
      style={({ pressed }) => [styles.row, activity.unread && styles.rowUnread, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, activity.unread && styles.iconWrapUnread]}>
        <Ionicons name={getActivityIcon(activity)} size={21} color={activity.unread ? T.primary : '#64748B'} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, activity.unread && styles.rowTitleUnread]} numberOfLines={1}>
            {getActivityTitle(activity)}
          </Text>
          <Text style={styles.timeText}>{formatRelativeTime(activity.lastMessageTimestamp)}</Text>
        </View>
        <Text style={styles.projectText} numberOfLines={1}>{activity.projectName}</Text>
        <Text style={styles.messageText} numberOfLines={2}>
          {activity.lastMessageSender ? `${activity.lastMessageSender}: ` : ''}
          {activity.lastMessage || 'No recent messages'}
        </Text>
      </View>
      {activity.unread && activity.unseenCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{activity.unseenCount > 99 ? '99+' : activity.unseenCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function InboxScreen() {
  const [data, setData] = useState<ChatInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const response = await api.get<ChatInboxResponse>('/api/chat/inbox', {
        params: { projectLimit: 20, activityLimit: 50 },
      });
      setData(response.data);
    } catch {
      setError('Unable to load inbox.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const activities = useMemo(() => data?.recentActivities || [], [data?.recentActivities]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Messages</Text>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{data?.totalUnread || 0}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadInbox(true)} tintColor={T.primary} colors={[T.primary]} />
        }
      >
        {loading && activities.length === 0 ? (
          <StateView loading title="Loading inbox" />
        ) : error ? (
          <StateView title="Inbox unavailable" message={error} icon="warning-outline" actionLabel="Try again" onAction={loadInbox} />
        ) : activities.length === 0 ? (
          <StateView title="No messages yet" message="Team, room, and direct chat activity will appear here." icon="mail-open-outline" />
        ) : (
          activities.map((activity) => (
            <InboxRow
              key={`${activity.projectId}-${activity.chatType}-${activity.roomId || activity.username || 'team'}`}
              activity={activity}
            />
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
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
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0,
  },
  countBadge: {
    minWidth: 38,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(21,93,252,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countText: {
    color: T.primary,
    fontSize: 14,
    fontWeight: '800',
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
  },
  rowPressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: 'rgba(21,93,252,0.09)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  rowTitleUnread: {
    color: T.primary,
    fontWeight: '800',
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  projectText: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  messageText: {
    marginTop: 5,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  unreadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: T.primary,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
