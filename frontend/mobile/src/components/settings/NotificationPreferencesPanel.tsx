import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { T } from '../../constants/tokens';
import {
  NotificationChannel,
  NotificationPreferenceRow,
  notificationPreferencesService,
} from '../../services/notification-preferences-service';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const EVENT_TYPES: { value: string; label: string; description: string; icon: IconName }[] = [
  { value: 'CHAT_ACTIVITY', label: 'Chat activity', description: 'Messages, mentions, replies, reactions.', icon: 'message-text-outline' },
  { value: 'TASK_ACTIVITY', label: 'Task activity', description: 'Assignments, changes, and board updates.', icon: 'clipboard-check-outline' },
  { value: 'PROJECT_ACTIVITY', label: 'Project activity', description: 'Project pages and workspace updates.', icon: 'bell-outline' },
  { value: 'TEAM_ACTIVITY', label: 'Team activity', description: 'Invites, roles, membership changes.', icon: 'account-group-outline' },
  { value: 'REMINDER_ACTIVITY', label: 'Reminders', description: 'Due-date and overdue reminders.', icon: 'calendar-clock' },
];

const CHANNELS: { value: NotificationChannel; label: string; icon: IconName }[] = [
  { value: 'IN_APP', label: 'In-app', icon: 'bell-outline' },
  { value: 'EMAIL', label: 'Email', icon: 'email-outline' },
];

const prefKey = (eventType: string, channel: NotificationChannel) => `${eventType}:${channel}`;

export default function NotificationPreferencesPanel({
  projectId,
  helperText,
}: {
  projectId?: number;
  helperText?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await notificationPreferencesService.getPreferences(projectId ?? null);
      const map: Record<string, boolean> = {};
      rows.forEach((row: NotificationPreferenceRow) => {
        map[prefKey(row.eventType, row.channel)] = row.enabled;
      });
      setPrefs(map);
    } catch {
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (eventType: string, channel: NotificationChannel) => {
    const key = prefKey(eventType, channel);
    const next = !(prefs[key] ?? true);
    setSavingKey(key);
    setPrefs((prev) => ({ ...prev, [key]: next }));
    try {
      await notificationPreferencesService.updatePreference({
        projectId: projectId ?? null,
        eventType,
        channel,
        enabled: next,
      });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !next }));
      Alert.alert('Error', 'Failed to update notification preference');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={T.primary} size="small" />
        <Text style={styles.loadingText}>Loading preferences…</Text>
      </View>
    );
  }

  return (
    <View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <View style={{ gap: 10 }}>
        {EVENT_TYPES.map((event) => (
          <View key={event.value} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={styles.eventIcon}>
                <MaterialCommunityIcons name={event.icon} size={16} color={T.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{event.label}</Text>
                <Text style={styles.eventDesc}>{event.description}</Text>
              </View>
            </View>

            <View style={styles.channelRow}>
              {CHANNELS.map((channel) => {
                const key = prefKey(event.value, channel.value);
                const enabled = prefs[key] ?? true;
                const busy = savingKey === key;
                return (
                  <TouchableOpacity
                    key={channel.value}
                    style={[styles.toggle, enabled ? styles.toggleOn : styles.toggleOff]}
                    onPress={() => handleToggle(event.value, channel.value)}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={channel.icon}
                      size={14}
                      color={enabled ? '#15803D' : T.textMuted}
                    />
                    <Text style={[styles.toggleLabel, { color: enabled ? '#15803D' : T.textSecondary }]}>
                      {channel.label}
                    </Text>
                    {busy ? (
                      <ActivityIndicator size="small" color={enabled ? '#15803D' : T.textMuted} />
                    ) : (
                      <View style={[styles.statusPill, enabled ? styles.statusPillOn : styles.statusPillOff]}>
                        <Text style={[styles.statusPillText, { color: enabled ? '#fff' : T.textMuted }]}>
                          {enabled ? 'On' : 'Off'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { color: T.textSecondary, fontSize: 13, fontWeight: '600' },

  helper: { fontSize: 12.5, color: T.textSecondary, lineHeight: 18, marginBottom: 14 },

  eventCard: { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13 },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: T.bgSecondary,
    borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center',
  },
  eventLabel: { fontSize: 14, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },
  eventDesc: { fontSize: 12, color: T.textSecondary, marginTop: 2, lineHeight: 16 },

  channelRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  toggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, borderWidth: 1,
  },
  toggleOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  toggleOff: { backgroundColor: T.bg, borderColor: T.border },
  toggleLabel: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, minWidth: 30, alignItems: 'center' },
  statusPillOn: { backgroundColor: '#22C55E' },
  statusPillOff: { backgroundColor: T.bgTertiary },
  statusPillText: { fontSize: 10, fontWeight: '800' },
});
