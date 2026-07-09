import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { T, STATUS_MAP, StatusKey } from '../../constants/tokens';
import { BoardTask, useProjectBoard } from '../../hooks/useProjectBoard';
import MobileTaskDetailSheet from '../task-detail/MobileTaskDetailSheet';

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
  if (!date) return 'No date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStatus(status?: string | null) {
  return (status || 'TODO').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function statusMeta(status?: string | null) {
  return STATUS_MAP[(status || 'TODO') as StatusKey] ?? T.statusTodo;
}

function timelineTime(task: BoardTask) {
  const date = parseTaskDate(task.startDate) || parseTaskDate(task.dueDate) || parseTaskDate(task.createdAt);
  return date?.getTime() ?? Number.MAX_SAFE_INTEGER;
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

function TaskTimelineItem({ task, isLast, onPress }: { task: BoardTask; isLast: boolean; onPress: () => void }) {
  const status = statusMeta(task.status);
  const priorityTone = task.priority ? PRIORITY_TONES[task.priority.toUpperCase()] ?? T.textSecondary : T.textMuted;
  const overdue = isOverdue(task);

  return (
    <View style={styles.itemRow}>
      <View style={styles.markerColumn}>
        <View style={[styles.marker, { backgroundColor: status.dot }]} />
        {!isLast ? <View style={styles.markerLine} /> : null}
      </View>

      <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Start</Text>
            <Text style={styles.dateText}>{formatDate(task.startDate)}</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={16} color="#CBD5E1" />
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Due</Text>
            <Text style={[styles.dateText, overdue && styles.overdueText]}>{formatDate(task.dueDate)}</Text>
          </View>
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.projectTaskNumber ? `TSK-${task.projectTaskNumber} ` : ''}
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
            <Text style={[styles.statusText, { color: status.text }]} numberOfLines={1}>
              {formatStatus(task.status)}
            </Text>
          </View>

          {task.priority ? (
            <View style={styles.priorityPill}>
              <MaterialCommunityIcons name="flag-variant" size={12} color={priorityTone} />
              <Text style={[styles.priorityText, { color: priorityTone }]} numberOfLines={1}>
                {task.priority}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="account-circle-outline" size={14} color={T.textMuted} />
            <Text style={styles.footerText} numberOfLines={1}>{task.assigneeName || 'Unassigned'}</Text>
          </View>
          {typeof task.storyPoint === 'number' ? (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="chart-box-outline" size={14} color={T.textMuted} />
              <Text style={styles.footerText}>{task.storyPoint} pts</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function MobileTimelineScreen({
  projectId,
  projectName,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}) {
  const { tasks, loading, refreshing, error, refresh } = useProjectBoard(projectId);
  const [selectedTaskId, setSelectedTaskId] = React.useState<number | null>(null);

  const timelineTasks = useMemo(
    () => [...tasks].sort((a, b) => timelineTime(a) - timelineTime(b)),
    [tasks]
  );

  const stats = useMemo(() => {
    const scheduled = tasks.filter((task) => task.startDate || task.dueDate).length;
    const overdue = tasks.filter(isOverdue).length;
    const done = tasks.filter((task) => task.status === 'DONE').length;
    return { scheduled, overdue, done };
  }, [tasks]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topOffset }]}>
        <ActivityIndicator color={T.primary} />
        <Text style={styles.centerText}>Loading timeline...</Text>
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
          <MaterialCommunityIcons name="timeline-clock-outline" size={22} color={T.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow} numberOfLines={1}>{projectName || 'Project'}</Text>
          <Text style={styles.title}>Timeline</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.scheduled}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, stats.overdue > 0 && styles.overdueText]}>{stats.overdue}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: T.statusDone.text }]}>{stats.done}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {timelineTasks.length ? (
        <View style={styles.timelineList}>
          {timelineTasks.map((task, index) => (
            <TaskTimelineItem
              key={task.id}
              task={task}
              isLast={index === timelineTasks.length - 1}
              onPress={() => setSelectedTaskId(task.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={34} color={T.textMuted} />
          <Text style={styles.emptyTitle}>No timeline tasks yet</Text>
          <Text style={styles.emptyText}>Tasks with start or due dates will appear here.</Text>
        </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
    gap: 10,
  },
  centerText: {
    color: T.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primaryLight,
    borderWidth: 1,
    borderColor: '#D8E6FF',
  },
  eyebrow: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: T.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minHeight: 70,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    justifyContent: 'center',
  },
  statValue: {
    color: T.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 2,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  timelineList: {
    paddingTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  markerColumn: {
    width: 26,
    alignItems: 'center',
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  taskCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  dateBlock: {
    flex: 1,
    minWidth: 0,
  },
  dateLabel: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dateText: {
    color: T.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  overdueText: {
    color: '#DC2626',
  },
  taskTitle: {
    color: T.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 160,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '70%',
  },
  footerText: {
    color: T.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.border,
    padding: 24,
  },
  emptyTitle: {
    marginTop: 10,
    color: T.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 6,
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
