/**
 * ReportScreen.tsx – Full mobile report dashboard.
 * Sections: Header → KPI Strip → Active Schedules → Export Contents
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, ActivityIndicator, Platform, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Polyline, Line } from 'react-native-svg';
import { T } from '../../constants/tokens';
import { useReport } from '../../hooks/useReport';
import { ScheduledReportResponse } from '../../services/report-service';
import DownloadSheet  from './DownloadSheet';
import ScheduleWizard from './ScheduleWizard';
import { StateView } from '../ui/StateView';

// ── Icons ─────────────────────────────────────────────────────────────────────
function IcDownload({ c = '#fff', size = 18 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><Polyline points="7 10 12 15 17 10" /><Path d="M12 15V3" /></Svg>;
}
function IcClock({ c = '#fff', size = 18 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round"><Circle cx={12} cy={12} r={10} /><Path d="M12 6v6l4 2" /></Svg>;
}
function IcChart({ c = '#fff', size = 18 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Rect x={3} y={3} width={18} height={18} rx={2} /><Path d="M8 17V13M12 17v-6M16 17V9" /></Svg>;
}
function IcTrash({ c = T.textMuted, size = 15 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" /></Svg>;
}
function IcPause({ c = T.textMuted, size = 15 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><Line x1={6} y1={4} x2={6} y2={20} /><Line x1={18} y1={4} x2={18} y2={20} /></Svg>;
}
function IcPlay({ c = T.textMuted, size = 15 }: { c?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth={2} strokeLinecap="round"><Path d="M5 3l14 9-14 9V3z" /></Svg>;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, urgent }: {
  label: string; value: string | number; sub?: string; color: string; urgent?: boolean;
}) {
  return (
    <View style={[kpi.card, urgent && { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
      <View style={[kpi.blob, { backgroundColor: color + '15' }]}>
        <IcChart c={color} size={14} />
      </View>
      <Text style={[kpi.value, { color }]}>{value}</Text>
      <Text style={kpi.label}>{label}</Text>
      {sub && <Text style={kpi.sub}>{sub}</Text>}
    </View>
  );
}

const kpi = StyleSheet.create({
  card:  { flex: 1, minWidth: '28%', borderRadius: 18, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }) },
  blob:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  value: { fontSize: 24, fontWeight: '900', lineHeight: 26, marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '800', color: T.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  sub:   { fontSize: 12, color: T.textSecondary, marginTop: 2, lineHeight: 16 },
});

// ── Schedule Row ──────────────────────────────────────────────────────────────
function ScheduleRow({ sr, onDelete, onToggle }: {
  sr: ScheduledReportResponse;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [dL, setDl] = useState(false);
  const [tL, setTl] = useState(false);

  const statusColor =
    sr.status === 'ACTIVE'  ? '#16A34A' :
    sr.status === 'PAUSED'  ? '#F59E0B' : '#DC2626';

  const freqLabel = (() => {
    if (sr.scheduleType === 'ONE_TIME') return `Once · ${sr.scheduledDate ?? '—'}`;
    switch (sr.frequency) {
      case 'DAILY':   return `Daily at ${sr.sendTime}`;
      case 'WEEKLY':  return `Weekly (day ${sr.sendDayOfWeek}) at ${sr.sendTime}`;
      case 'MONTHLY': return `Monthly (day ${sr.sendDayOfMonth}) at ${sr.sendTime}`;
      case 'CUSTOM':  return `Every ${sr.customIntervalDays}d at ${sr.sendTime}`;
      default:        return sr.sendTime;
    }
  })();

  const handleDel = async () => {
    Alert.alert('Delete Schedule', 'Are you sure you want to delete this scheduled report?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { setDl(true); await onDelete(); setDl(false); } },
    ]);
  };
  const handleTog = async () => { setTl(true); await onToggle(); setTl(false); };

  return (
    <View style={sr_s.row}>
      <View style={[sr_s.dot, { backgroundColor: statusColor }]} />
      <View style={{ flex: 1 }}>
        <View style={sr_s.labelRow}>
          <Text style={sr_s.freq}>{freqLabel}</Text>
          <View style={[sr_s.badge, { backgroundColor: statusColor + '18' }]}>
            <Text style={[sr_s.badgeTxt, { color: statusColor }]}>{sr.status}</Text>
          </View>
          <View style={[sr_s.badge, { backgroundColor: T.primaryLight }]}>
            <Text style={[sr_s.badgeTxt, { color: T.primary }]}>{sr.format}</Text>
          </View>
        </View>
        <Text style={sr_s.sub} numberOfLines={1}>
          To: {sr.recipientsTo.join(', ')}
          {sr.nextSendAt ? ` · Next: ${new Date(sr.nextSendAt).toLocaleDateString()}` : ''}
          {` · Sent: ${sr.sendCount}×`}
        </Text>
      </View>
      <View style={sr_s.actions}>
        {(sr.status === 'ACTIVE' || sr.status === 'PAUSED') && (
          <TouchableOpacity onPress={handleTog} disabled={tL} style={sr_s.actionBtn}>
            {tL ? <ActivityIndicator size="small" color={T.textMuted} /> :
             sr.status === 'ACTIVE' ? <IcPause /> : <IcPlay />}
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDel} disabled={dL} style={[sr_s.actionBtn, { marginLeft: 4 }]}>
          {dL ? <ActivityIndicator size="small" color={T.textMuted} /> : <IcTrash />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sr_s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3F4F6' },
  dot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  freq:     { fontSize: 11, fontWeight: '700', color: '#1F2937' },
  badge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  sub:      { fontSize: 12, color: T.textSecondary },
  actions:  { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonBox({ w, h, radius = 8, style }: { w?: number | string; h: number; radius?: number; style?: object }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: radius, backgroundColor: '#E2E8F0', opacity: anim }, style]}
    />
  );
}

function ReportSkeleton({ topOffset = 0 }: { topOffset?: number }) {
  return (
    <ScrollView
      style={ms.scroll}
      contentContainerStyle={[ms.content, { paddingTop: topOffset + 16 }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Header card skeleton */}
      <View style={sk.card}>
        <View style={sk.brandRow}>
          <SkeletonBox w={26} h={26} radius={8} />
          <SkeletonBox w={160} h={10} radius={5} />
        </View>
        <SkeletonBox w='80%' h={22} radius={8} style={{ marginBottom: 10 }} />
        <SkeletonBox w='50%' h={14} radius={6} style={{ marginBottom: 18 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBox w={undefined} h={48} radius={14} style={{ flex: 1 }} />
          <SkeletonBox w={undefined} h={48} radius={14} style={{ flex: 1 }} />
        </View>
      </View>

      {/* KPI grid skeleton */}
      <View style={{ gap: 4 }}>
        <SkeletonBox w={90} h={10} radius={5} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={[sk.card, { flex: 1, minWidth: '28%', padding: 14, gap: 8 }]}>
              <SkeletonBox w={32} h={32} radius={10} />
              <SkeletonBox w='60%' h={20} radius={6} />
              <SkeletonBox w='80%' h={9} radius={4} />
            </View>
          ))}
        </View>
      </View>

      {/* Schedules card skeleton */}
      <View style={sk.card}>
        <SkeletonBox w={100} h={10} radius={5} style={{ marginBottom: 18 }} />
        {[0,1].map(i => (
          <View key={i} style={[sk.scheduleRow, { marginBottom: i === 0 ? 8 : 0 }]}>
            <SkeletonBox w={8} h={8} radius={4} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox w='70%' h={11} radius={5} />
              <SkeletonBox w='50%' h={9} radius={4} />
            </View>
            <SkeletonBox w={30} h={30} radius={8} />
          </View>
        ))}
        <SkeletonBox w={undefined} h={40} radius={12} style={{ marginTop: 12 }} />
      </View>

      {/* Export contents skeleton */}
      <View style={sk.card}>
        <SkeletonBox w={110} h={10} radius={5} style={{ marginBottom: 18 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={[sk.exportItem]}>
              <SkeletonBox w={28} h={28} radius={6} />
              <SkeletonBox w={undefined} h={11} radius={5} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          {[0,1,2,3].map(i => <SkeletonBox key={i} w={60} h={28} radius={10} />)}
        </View>
      </View>
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 3 } }) },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportItem:  { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#F8FAFF' },
});

// ── Section Card ─────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[c_s.card, style]}>
      {children}
    </View>
  );
}
const c_s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 3 } }) },
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 10, fontWeight: '800', color: T.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>{children}</Text>;
}

// ── Content items for "Export Contents" ──────────────────────────────────────
const EXPORT_ITEMS = [
  { emoji: '📊', label: 'Project Overview & KPIs',     color: T.primary },
  { emoji: '⚡', label: 'Sprint / Kanban Analytics',   color: '#F59E0B' },
  { emoji: '👥', label: 'Team Workload Breakdown',      color: '#16A34A' },
  { emoji: '⚠️', label: 'Overdue & Risk Analysis',     color: '#DC2626' },
  { emoji: '🚩', label: 'Milestone Tracker',            color: '#7C3AED' },
  { emoji: '📋', label: 'Full Task Table',              color: '#6B7280' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  projectId:  number;
  projectName?: string;
  topOffset?: number;
}

export default function ReportScreen({ projectId, projectName, topOffset = 0 }: Props) {
  const {
    data, loading, error,
    schedules, schLoading,
    deleteSchedule, toggleSchedule,
    refreshSchedules, refresh,
  } = useReport(projectId);

  const [dlOpen,  setDlOpen]  = useState(false);
  const [schOpen, setSchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    await refreshSchedules();
    setRefreshing(false);
  };

  const name = projectName || data?.project?.name || 'Project';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return <ReportSkeleton topOffset={topOffset} />;
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <View style={[ms.flex1, { paddingTop: topOffset }]}>
        <StateView title="Report unavailable" message={error} icon="warning-outline" actionLabel="Try again" onAction={refresh} />
      </View>
    );
  }

  const d = data;
  const completionPct  = d?.completionPct  ?? 0;

  const kpiCards = [
    { label: 'Total Tasks', value: d?.metrics.totalTasks ?? 0,    color: T.primary },
    { label: 'Completed',   value: d?.metrics.completedTasks ?? 0, color: '#16A34A' },
    { label: 'Progress',    value: `${completionPct}%`,
      sub: completionPct >= 70 ? 'On track 🟢' : completionPct >= 40 ? 'In progress 🟡' : 'At risk 🔴',
      color: completionPct >= 70 ? '#16A34A' : completionPct >= 40 ? '#F59E0B' : '#DC2626' },
    { label: 'Overdue',     value: d?.metrics.overdueTasks ?? 0,   color: '#DC2626', urgent: (d?.metrics.overdueTasks ?? 0) > 0 },
    { label: 'Team Size',   value: d?.members.length ?? 0,          color: '#7C3AED' },
    {
      label: d?.isAgile ? 'Active Sprint' : 'Avg Lead Time',
      value: d?.isAgile
        ? (d.activeSprint ? `${d.activeSprint.completionRate}%` : '—')
        : `${d?.avgLeadTimeDays ?? 0}d`,
      color: '#0891B2',
    },
  ];

  const activeCount = schedules.filter(s => s.status === 'ACTIVE').length;

  return (
    <>
      <DownloadSheet
        visible={dlOpen}
        onClose={() => setDlOpen(false)}
        projectId={projectId}
        projectName={name}
      />
      <ScheduleWizard
        visible={schOpen}
        onClose={() => setSchOpen(false)}
        projectId={projectId}
        projectName={name}
        onScheduled={refreshSchedules}
      />

      <ScrollView
        style={ms.scroll}
        contentContainerStyle={[ms.content, { paddingTop: topOffset + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
        <Card>
          {/* Branding row */}
          <View style={ms.brandRow}>
            <LinearGradient colors={[T.primary, '#4D8BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.brandIcon}>
              <IcChart c="#fff" size={14} />
            </LinearGradient>
            <Text style={ms.brandTxt}>PLANORA · REPORT STUDIO</Text>
          </View>

          <Text style={ms.projectTitle} numberOfLines={2}>{name} Analytics</Text>

          <View style={ms.badgeRow}>
            <View style={[ms.pill, { backgroundColor: d?.isAgile ? T.primaryLight : '#F3E8FF' }]}>
              <Text style={[ms.pillTxt, { color: d?.isAgile ? T.primary : '#7C3AED' }]}>
                {d?.isAgile ? '⚡ Agile / Scrum' : '📋 Kanban'}
              </Text>
            </View>
            {(d?.unassignedCount ?? 0) > 0 && (
              <View style={[ms.pill, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[ms.pillTxt, { color: '#DC2626' }]}>⚠ {d?.unassignedCount} unassigned</Text>
              </View>
            )}
            <Text style={ms.genAt}>Generated {d?.generatedAt}</Text>
          </View>

          {/* Action buttons */}
          <View style={ms.actionRow}>
            <TouchableOpacity onPress={() => setDlOpen(true)} activeOpacity={0.85} style={ms.actionBtn}>
              <LinearGradient colors={[T.primary, '#4D8BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.actionBtnInner}>
                <IcDownload c="#fff" size={16} />
                <View>
                  <Text style={ms.actionBtnLabel}>Download</Text>
                  <Text style={ms.actionBtnSub}>PDF · Excel · Both</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSchOpen(true)} activeOpacity={0.85} style={ms.actionBtn}>
              <LinearGradient colors={['#7C3AED', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.actionBtnInner}>
                <IcClock c="#fff" size={16} />
                <View>
                  <Text style={ms.actionBtnLabel}>Schedule</Text>
                  <Text style={ms.actionBtnSub}>Email · Recurring</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
        <View style={{ gap: 4 }}>
          <SectionLabel>Key Metrics</SectionLabel>
          <View style={ms.kpiGrid}>
            {kpiCards.map((c, i) => (
              <KpiCard key={i} {...c} sub={(c as any).sub} urgent={(c as any).urgent} />
            ))}
          </View>
        </View>

        {/* ── ACTIVE SCHEDULES ────────────────────────────────────────────── */}
        <Card>
          <View style={ms.secHeader}>
            <SectionLabel>Active Schedules</SectionLabel>
            <View style={[ms.pill, { backgroundColor: T.primaryLight, marginBottom: 14 }]}>
              <Text style={[ms.pillTxt, { color: T.primary }]}>{activeCount} active</Text>
            </View>
          </View>

          {schLoading ? (
            <ActivityIndicator size="small" color={T.primary} style={{ marginVertical: 12 }} />
          ) : schedules.length === 0 ? (
            <View style={ms.emptyBox}>
              <Text style={ms.emptyTxt}>No schedules yet. Create one to start automatic report emails.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {schedules.map(sr => (
                <ScheduleRow
                  key={sr.id}
                  sr={sr}
                  onDelete={() => deleteSchedule(sr.id)}
                  onToggle={() => toggleSchedule(sr)}
                />
              ))}
            </View>
          )}

          <TouchableOpacity onPress={() => setSchOpen(true)} activeOpacity={0.8} style={ms.addSchBtn}>
            <IcClock c={T.primary} size={14} />
            <Text style={ms.addSchTxt}>Add another schedule</Text>
          </TouchableOpacity>
        </Card>

        {/* ── EXPORT CONTENTS ─────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Export Contents</SectionLabel>
          <View style={ms.exportGrid}>
            {EXPORT_ITEMS.map(item => (
              <View key={item.label} style={ms.exportItem}>
                <Text style={ms.exportEmoji}>{item.emoji}</Text>
                <Text style={ms.exportLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Format badges */}
          <View style={ms.fmtBadges}>
            {[
              { label: 'PDF',    color: '#DC2626', bg: '#FFF5F5' },
              { label: 'Excel',  color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Both',   color: T.primary, bg: T.primaryLight },
              { label: '🔒 Secure', color: '#7C3AED', bg: '#FAF5FF' },
            ].map(f => (
              <View key={f.label} style={[ms.fmtBadge, { backgroundColor: f.bg }]}>
                <Text style={[ms.fmtBadgeTxt, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Footer */}
        <Text style={ms.footer}>
          Planora Report Studio · {d?.generatedAt ?? ''}
        </Text>
      </ScrollView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  flex1:  { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: '#F0F4FF' },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },

  loadingTxt: { fontSize: 13, color: T.textMuted, marginTop: 12 },
  errTxt:     { fontSize: 13, color: '#DC2626', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  retryBtn:   { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: T.primaryLight },
  retryTxt:   { fontSize: 13, fontWeight: '700', color: T.primary },

  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  brandIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandTxt:  { fontSize: 9.5, fontWeight: '900', color: T.textMuted, letterSpacing: 1.4 },
  projectTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A2E', letterSpacing: -0.5, lineHeight: 26, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  pill:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pillTxt:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  genAt:    { fontSize: 10, color: T.textMuted },

  actionRow:       { flexDirection: 'row', gap: 10 },
  actionBtn:       { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionBtnInner:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  actionBtnLabel:  { fontSize: 13, fontWeight: '800', color: '#fff' },
  actionBtnSub:    { fontSize: 9.5, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  secHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 12, padding: 16, backgroundColor: '#F8FAFF' },
  emptyTxt: { fontSize: 11, color: T.textMuted, textAlign: 'center', lineHeight: 16 },

  addSchBtn: { marginTop: 12, height: 40, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.primary + '50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addSchTxt: { fontSize: 12, fontWeight: '700', color: T.primary },

  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  exportItem: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#F8FAFF' },
  exportEmoji: { fontSize: 18 },
  exportLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: '#374151', lineHeight: 14 },

  fmtBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  fmtBadge:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  fmtBadgeTxt: { fontSize: 11, fontWeight: '700' },

  footer: { fontSize: 10, color: '#C4C9D4', textAlign: 'center', paddingVertical: 4 },
});
