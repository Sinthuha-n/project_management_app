import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { STATUS_MAP, StatusKey, T } from '../../constants/tokens';
import { BoardTask, useProjectBoard } from '../../hooks/useProjectBoard';
import MobileTaskDetailSheet from '../task-detail/MobileTaskDetailSheet';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseTaskDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusMeta(status?: string | null) {
  return STATUS_MAP[(status || 'TODO') as StatusKey] ?? T.statusTodo;
}

export default function MobileCalendarScreen({
  projectId,
  projectName,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}) {
  const { tasks, loading, refreshing, error, refresh } = useProjectBoard(projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(() => dateKey(today));

  // Map dueDate -> tasks for fast lookup
  const tasksByDay = useMemo(() => {
    const map = new Map<string, BoardTask[]>();
    tasks.forEach((task) => {
      const due = parseTaskDate(task.dueDate);
      if (!due) return;
      const key = dateKey(due);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [tasks]);

  // Build the calendar grid for the current month (leading/trailing nulls)
  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) list.push(new Date(year, month, day));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewDate]);

  const selectedTasks = useMemo(() => tasksByDay.get(selectedKey) ?? [], [tasksByDay, selectedKey]);
  const monthCount = useMemo(
    () => cells.reduce((sum, date) => sum + (date ? (tasksByDay.get(dateKey(date))?.length ?? 0) : 0), 0),
    [cells, tasksByDay]
  );

  const changeMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(dateKey(now));
  };

  const todayKey = dateKey(today);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topOffset }]}>
        <ActivityIndicator color={T.primary} />
        <Text style={styles.centerText}>Loading calendar...</Text>
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
          <MaterialCommunityIcons name="calendar-month-outline" size={22} color={T.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow} numberOfLines={1}>{projectName || 'Project'}</Text>
          <Text style={styles.title}>Calendar</Text>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={goToday} activeOpacity={0.7}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={T.textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.monthLabel}>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
            <Text style={styles.monthSub}>{monthCount} due this month</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={22} color={T.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((day, idx) => (
            <View key={idx} style={styles.weekCell}>
              <Text style={styles.weekText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((date, idx) => {
            if (!date) return <View key={`empty-${idx}`} style={styles.dayCell} />;
            const key = dateKey(date);
            const dayTasks = tasksByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <TouchableOpacity
                key={key}
                style={styles.dayCell}
                onPress={() => setSelectedKey(key)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.dayInner,
                  isToday && styles.dayToday,
                  isSelected && styles.daySelected,
                ]}>
                  <Text style={[
                    styles.dayText,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                {dayTasks.length ? (
                  <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
                ) : (
                  <View style={styles.dayDotPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {new Date(
            Number(selectedKey.split('-')[0]),
            Number(selectedKey.split('-')[1]),
            Number(selectedKey.split('-')[2])
          ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text style={styles.listHeaderCount}>{selectedTasks.length}</Text>
      </View>

      {selectedTasks.length ? (
        selectedTasks.map((task) => {
          const status = statusMeta(task.status);
          return (
            <TouchableOpacity key={task.id} activeOpacity={0.78} onPress={() => setSelectedTaskId(task.id)} style={styles.taskCard}>
              <View style={[styles.taskDot, { backgroundColor: status.dot }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                <View style={[styles.statusChip, { backgroundColor: status.bg, borderColor: status.border }]}>
                  <Text style={[styles.statusChipText, { color: status.text }]}>
                    {(task.status || 'TODO').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={30} color={T.textMuted} />
          <Text style={styles.emptyText}>No tasks due on this day.</Text>
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
  todayBtn: {
    paddingHorizontal: 14, height: 32, borderRadius: 16,
    backgroundColor: T.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  todayBtnText: { fontSize: 12.5, fontWeight: '800', color: T.primary },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1,
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },

  card: {
    backgroundColor: T.bg, borderRadius: 18, borderWidth: 1, borderColor: T.border,
    padding: 12, marginBottom: 18,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: T.bgSecondary, alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { fontSize: 16, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.3 },
  monthSub: { fontSize: 11, fontWeight: '600', color: T.textMuted, marginTop: 1 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekText: { fontSize: 11, fontWeight: '800', color: T.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayInner: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayToday: { backgroundColor: T.primaryLight },
  daySelected: { backgroundColor: T.primary },
  dayText: { fontSize: 14, fontWeight: '600', color: T.textPrimary },
  dayTextToday: { color: T.primary, fontWeight: '800' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.primary, marginTop: 3 },
  dayDotSelected: { backgroundColor: T.primary },
  dayDotPlaceholder: { width: 5, height: 5, marginTop: 3 },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  listHeaderText: { fontSize: 14.5, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2, flex: 1 },
  listHeaderCount: {
    fontSize: 12, fontWeight: '800', color: T.textSecondary,
    backgroundColor: T.bgTertiary, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
  },

  taskCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: T.bg, borderRadius: 14, borderWidth: 1, borderColor: T.border,
    padding: 13, marginBottom: 10,
  },
  taskDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 4 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: T.textPrimary, lineHeight: 19 },
  statusChip: {
    alignSelf: 'flex-start', marginTop: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13, color: T.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
