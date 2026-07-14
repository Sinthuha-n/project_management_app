import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { STATUS_MAP, StatusKey, T } from '../../constants/tokens';
import { BoardTask, useProjectBoard } from '../../hooks/useProjectBoard';
import MobileTaskDetailSheet from '../task-detail/MobileTaskDetailSheet';
import { GitHubTaskBadges } from '../github/GitHubTaskBadges';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIORITY_TONES: Record<string, string> = {
  URGENT: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#D97706',
  LOW: '#64748B',
};

function parseTaskDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = parseTaskDate(value);
  if (!date) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusMeta(status?: string | null) {
  return STATUS_MAP[(status || 'TODO') as StatusKey] ?? T.statusTodo;
}

function isOverdue(task: BoardTask) {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = parseTaskDate(task.dueDate);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function dueSortValue(task: BoardTask) {
  const date = parseTaskDate(task.dueDate);
  return date?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function TaskRow({ task, dotColor, onPress }: { task: BoardTask; dotColor: string; onPress: () => void }) {
  const priorityTone = task.priority ? PRIORITY_TONES[task.priority.toUpperCase()] ?? T.textSecondary : null;
  const overdue = isOverdue(task);
  const due = formatDate(task.dueDate);

  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.taskRow}>
      <View style={[styles.taskDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        <GitHubTaskBadges task={task} />
        <View style={styles.taskMeta}>
          {task.projectTaskNumber ? (
            <Text style={styles.taskKey}>#{task.projectTaskNumber}</Text>
          ) : null}
          {priorityTone ? (
            <View style={[styles.priorityChip, { backgroundColor: priorityTone + '18' }]}>
              <View style={[styles.priorityDot, { backgroundColor: priorityTone }]} />
              <Text style={[styles.priorityText, { color: priorityTone }]}>
                {task.priority!.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {due ? (
            <View style={styles.metaPill}>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={12}
                color={overdue ? '#DC2626' : T.textMuted}
              />
              <Text style={[styles.metaPillText, overdue && styles.overdueText]}>{due}</Text>
            </View>
          ) : null}
          {task.assigneeName ? (
            <View style={styles.metaPill}>
              <MaterialCommunityIcons name="account-circle-outline" size={12} color={T.textMuted} />
              <Text style={styles.metaPillText} numberOfLines={1}>{task.assigneeName}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MobileListScreen({
  projectId,
  projectName,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}) {
  const { tasks, columns, loading, refreshing, error, refresh } = useProjectBoard(projectId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const byStatus = new Map<string, BoardTask[]>();
    columns.forEach((column) => byStatus.set(column.status, []));
    const extra: BoardTask[] = [];

    tasks.forEach((task) => {
      const key = task.status || 'TODO';
      if (byStatus.has(key)) byStatus.get(key)!.push(task);
      else extra.push(task);
    });

    const sortTasks = (list: BoardTask[]) =>
      [...list].sort((a, b) => dueSortValue(a) - dueSortValue(b));

    const result = columns.map((column) => ({
      key: column.status,
      name: column.name,
      color: column.color || statusMeta(column.status).dot,
      tasks: sortTasks(byStatus.get(column.status) ?? []),
    }));

    if (extra.length) {
      result.push({ key: '__other', name: 'Other', color: T.textMuted, tasks: sortTasks(extra) });
    }

    return result;
  }, [tasks, columns]);

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topOffset }]}>
        <ActivityIndicator color={T.primary} />
        <Text style={styles.centerText}>Loading list...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topOffset }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="format-list-checks" size={22} color={T.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow} numberOfLines={1}>{projectName || 'Project'}</Text>
          <Text style={styles.title}>List</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{tasks.length}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={34} color={T.textMuted} />
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyText}>Tasks created in this project will appear here.</Text>
        </View>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsed[group.key];
          return (
            <View key={group.key} style={styles.group}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => toggle(group.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                <Text style={styles.groupCount}>{group.tasks.length}</Text>
                <MaterialCommunityIcons
                  name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color={T.textMuted}
                />
              </TouchableOpacity>

              {!isCollapsed && (
                group.tasks.length ? (
                  <View style={styles.groupBody}>
                    {group.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} dotColor={group.color} onPress={() => setSelectedTaskId(task.id)} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.groupEmpty}>No tasks in this column</Text>
                )
              )}
            </View>
          );
        })
      )}
      <MobileTaskDetailSheet
        visible={selectedTaskId !== null}
        taskId={selectedTaskId}
        projectId={projectId}
        onClose={() => setSelectedTaskId(null)}
        onChanged={refresh}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bgSecondary },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centerText: { color: T.textSecondary, fontSize: 13, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: T.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '900', color: T.textPrimary, letterSpacing: -0.5 },
  totalBadge: {
    minWidth: 34, height: 28, paddingHorizontal: 10, borderRadius: 14,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  totalBadgeText: { fontSize: 13, fontWeight: '800', color: T.textPrimary },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1,
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },

  group: {
    backgroundColor: T.bg, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    marginBottom: 12, overflow: 'hidden',
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupName: { flex: 1, fontSize: 14, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },
  groupCount: {
    fontSize: 12, fontWeight: '800', color: T.textSecondary,
    backgroundColor: T.bgTertiary, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
  },
  groupBody: { borderTopWidth: 1, borderTopColor: T.borderLight },
  groupEmpty: {
    fontSize: 12.5, color: T.textMuted, fontStyle: 'italic',
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2,
  },

  taskRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.borderLight,
  },
  taskDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: T.textPrimary, lineHeight: 19 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  taskKey: { fontSize: 11, fontWeight: '700', color: T.textMuted },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 160 },
  metaPillText: { fontSize: 11.5, fontWeight: '600', color: T.textSecondary },
  overdueText: { color: '#DC2626', fontWeight: '800' },

  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.textPrimary },
  emptyText: { fontSize: 13, color: T.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
