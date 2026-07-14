/**
 * WorkloadCard — Mobile-native workload distribution.
 * Fetches /api/projects/:id/members and shows animated horizontal bars per member.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import api from '../../api/axios';
import type { Task } from '../../hooks/useProjectSummary';

const COLORS = [
  '#155DFC', '#00875A', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#10B981',
];

interface Member {
  id: number;
  role: string;
  user: {
    userId: number;
    fullName?: string;
    username?: string;
    profilePicUrl?: string;
    email?: string;
  };
}

interface WorkloadEntry {
  name: string;
  initials: string;
  avatar?: string | null;
  color: string;
  tasks: number;
  done: number;
  overdue: number;
  pct: number;
}

function MemberBar({ entry, maxTasks }: { entry: WorkloadEntry; maxTasks: number }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: maxTasks > 0 ? entry.tasks / maxTasks : 0,
      duration: 900, useNativeDriver: false,
    }).start();
  }, [entry.tasks, fillAnim, maxTasks]);

  const initials = entry.initials;
  const doneColor = '#00875A';
  const overdueColor = '#EF4444';

  return (
    <View style={mb.row}>
      {/* Avatar */}
      {entry.avatar ? (
        <Image source={{ uri: entry.avatar }} style={mb.avatar} />
      ) : (
        <View style={[mb.avatar, { backgroundColor: entry.color }]}>
          <Text style={mb.initials}>{initials}</Text>
        </View>
      )}

      {/* Bar + meta */}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={mb.nameRow}>
          <Text style={mb.name} numberOfLines={1}>{entry.name}</Text>
          <Text style={mb.taskCount}>{entry.tasks} task{entry.tasks !== 1 ? 's' : ''}</Text>
        </View>
        <View style={mb.track}>
          <Animated.View style={[mb.fill, {
            backgroundColor: entry.color,
            width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <View style={mb.chipRow}>
          {entry.done > 0 && (
            <View style={[mb.chip, { backgroundColor: doneColor + '15', borderColor: doneColor + '30' }]}>
              <Text style={[mb.chipText, { color: doneColor }]}>✓ {entry.done}</Text>
            </View>
          )}
          {entry.overdue > 0 && (
            <View style={[mb.chip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={[mb.chipText, { color: overdueColor }]}>⚠ {entry.overdue}</Text>
            </View>
          )}
          <Text style={mb.pct}>{entry.pct}% done</Text>
        </View>
      </View>
    </View>
  );
}

export function WorkloadCard({ projectId, tasks }: { projectId: number; tasks: Task[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/api/projects/${projectId}/members`)
      .then(res => setMembers(res.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const workload = useMemo<WorkloadEntry[]>(() => {
    if (members.length === 0 && tasks.length === 0) return [];

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const map: Record<string, WorkloadEntry> = {};

    // Seed all members first (even those with 0 tasks)
    members.forEach((m, i) => {
      const name = m.user.fullName || m.user.username || `Member ${m.id}`;
      map[`M_${m.id}`] = {
        name, initials: name.substring(0, 2).toUpperCase(),
        avatar: m.user.profilePicUrl || null,
        color: COLORS[i % COLORS.length],
        tasks: 0, done: 0, overdue: 0, pct: 0,
      };
    });

    tasks.forEach(t => {
      let key = 'UNASSIGNED';
      if (t.assigneeName) {
        // Try to match by name to a member
        const found = members.find(m =>
          (m.user.fullName || m.user.username) === t.assigneeName
        );
        key = found ? `M_${found.id}` : `O_${t.assigneeName}`;
        if (!map[key] && !found) {
          const idx = Object.keys(map).length;
          map[key] = {
            name: t.assigneeName,
            initials: t.assigneeName.substring(0, 2).toUpperCase(),
            avatar: t.assigneePhotoUrl || null,
            color: COLORS[idx % COLORS.length],
            tasks: 0, done: 0, overdue: 0, pct: 0,
          };
        }
      } else {
        if (!map['UNASSIGNED']) {
          map['UNASSIGNED'] = {
            name: 'Unassigned', initials: 'UA',
            avatar: null, color: '#94A3B8',
            tasks: 0, done: 0, overdue: 0, pct: 0,
          };
        }
      }
      const entry = map[key];
      if (!entry) return;
      entry.tasks++;
      if (t.status === 'DONE') {
        entry.done++;
      } else if (t.dueDate && new Date(t.dueDate) < today) {
        entry.overdue++;
      }
    });

    return Object.values(map)
      .filter(e => e.tasks > 0)
      .sort((a, b) => b.tasks - a.tasks)
      .map(e => ({ ...e, pct: e.tasks > 0 ? Math.round((e.done / e.tasks) * 100) : 0 }));
  }, [members, tasks]);

  const maxTasks = useMemo(() => Math.max(...workload.map(e => e.tasks), 1), [workload]);

  if (loading) {
    return <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 }}>Loading workload...</Text>;
  }

  if (workload.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
        <Text style={{ fontSize: 24 }}>👥</Text>
        <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '600' }}>No workload data yet</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {workload.map((entry, i) => (
        <MemberBar key={`${entry.name}-${i}`} entry={entry} maxTasks={maxTasks} />
      ))}
    </View>
  );
}

const mb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  initials: { fontSize: 11, fontWeight: '800', color: '#fff' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1 },
  taskCount: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  track: {
    height: 6, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: '700' },
  pct: { fontSize: 10, fontWeight: '600', color: '#CBD5E1', marginLeft: 'auto' },
});
