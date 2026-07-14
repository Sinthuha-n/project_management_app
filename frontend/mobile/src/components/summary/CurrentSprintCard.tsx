/**
 * CurrentSprintCard — Mobile-native active sprint overview.
 * Glassmorphic card with animated progress bar, days-left badge, and task counts.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { Task, Sprint } from '../../hooks/useProjectSummary';

const PRIMARY = '#155DFC';
const GREEN   = '#00875A';
const RED     = '#EF4444';
const AMBER   = '#F59E0B';

export function CurrentSprintCard({ tasks, sprints }: { tasks: Task[]; sprints: Sprint[] }) {
  const activeSprint = useMemo(() => sprints.find(s => s.status === 'ACTIVE'), [sprints]);

  const { sprintTasks, donePoints, totalPoints, doneTasks, pct, isUrgent, daysText } = useMemo(() => {
    if (!activeSprint) return { sprintTasks: [], donePoints: 0, totalPoints: 0, doneTasks: 0, pct: 0, daysLeft: 0, isUrgent: false, daysText: '' };

    const st = tasks.filter(t => t.sprintId === activeSprint.id);
    const total = st.reduce((a, t) => a + (t.storyPoint || 0), 0);
    const done = st.filter(t => t.status === 'DONE');
    const doneP = done.reduce((a, t) => a + (t.storyPoint || 0), 0);
    const pct = total === 0 ? 0 : Math.round((doneP / total) * 100);

    let daysLeft = 0, isUrgent = false, daysText = 'Ending soon';
    if (activeSprint.endDate) {
      const diff = new Date(activeSprint.endDate).getTime() - Date.now();
      daysLeft = Math.ceil(diff / 86400000);
      if (daysLeft >= 0) {
        daysText = `${daysLeft} Day${daysLeft !== 1 ? 's' : ''} Left`;
        isUrgent = daysLeft <= 3;
      } else {
        daysText = `Ended ${Math.abs(daysLeft)}d ago`;
        isUrgent = true;
      }
    }
    return { sprintTasks: st, donePoints: doneP, totalPoints: total, doneTasks: done.length, pct, daysLeft, isUrgent, daysText };
  }, [activeSprint, tasks]);

  const progAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progAnim, { toValue: pct / 100, duration: 1200, useNativeDriver: false }).start();
  }, [pct]);

  if (!activeSprint) {
    return (
      <View style={st.emptyWrap}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </Svg>
        <Text style={st.emptyText}>No active sprint</Text>
        <Text style={st.emptyHint}>{"Start a sprint to track your team's progress"}</Text>
      </View>
    );
  }

  const barColor = pct >= 75 ? GREEN : pct >= 40 ? PRIMARY : AMBER;
  const badgeBg  = isUrgent ? '#FEF2F2' : '#F0FDF4';
  const badgeColor = isUrgent ? RED : GREEN;

  return (
    <View style={st.inner}>
      {/* Sprint name + days badge */}
      <View style={st.topRow}>
        <Text style={st.sprintName} numberOfLines={1}>{activeSprint.name}</Text>
        <View style={[st.daysBadge, { backgroundColor: badgeBg, borderColor: badgeColor + '33' }]}>
          <Text style={[st.daysText, { color: badgeColor }]}>{daysText}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={st.barSection}>
        <View style={st.barMeta}>
          <Text style={st.barLabel}>Points: {donePoints} / {totalPoints}</Text>
          <Text style={[st.barPct, { color: barColor }]}>{pct}%</Text>
        </View>
        <View style={st.track}>
          <Animated.View style={[st.fill, {
            backgroundColor: barColor,
            width: progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
          {/* Glow tip */}
          <Animated.View style={[st.glowTip, {
            backgroundColor: barColor,
            left: progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '98%'] }),
          }]} />
        </View>
      </View>

      {/* Task stats row */}
      <View style={st.statsRow}>
        <View style={st.stat}>
          <Text style={st.statVal}>{doneTasks}</Text>
          <Text style={st.statLbl}>Done</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.stat}>
          <Text style={[st.statVal, { color: AMBER }]}>{sprintTasks.length - doneTasks}</Text>
          <Text style={st.statLbl}>Remaining</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.stat}>
          <Text style={[st.statVal, { color: PRIMARY }]}>{sprintTasks.length}</Text>
          <Text style={st.statLbl}>Total Tasks</Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  inner: { gap: 16 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sprintName: { fontSize: 15, fontWeight: '800', color: PRIMARY, flex: 1, letterSpacing: -0.2 },
  daysBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  daysText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  barSection: { gap: 6 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  barPct: { fontSize: 12, fontWeight: '800' },
  track: {
    height: 8, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'visible', position: 'relative',
  },
  fill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 6 },
  glowTip: {
    position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8,
    opacity: 0.4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
  },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
  statVal: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  emptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  emptyHint: { fontSize: 11, fontWeight: '500', color: '#CBD5E1', textAlign: 'center' },
});
