import React, { useRef, useEffect, useMemo, createContext, useContext, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated,
  TouchableOpacity, RefreshControl, Platform, Dimensions, InteractionManager, Easing, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useProjectSummary } from '../../hooks/useProjectSummary';
import OfflineStaleBanner from '../ui/OfflineStaleBanner';
import { DonutPriorityChart } from './charts/DonutPriorityChart';
import { BurndownLineChart } from './charts/BurndownLineChart';
import { VelocityBarChart } from './charts/VelocityBarChart';
import { LeadTimeChart } from './charts/LeadTimeChart';
import { CurrentSprintCard } from './CurrentSprintCard';
import { ProjectNotesCard } from './ProjectNotesCard';
import { WorkloadCard } from './WorkloadCard';
import { T } from '../../constants/tokens';

const GREEN = '#00875A';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const { width: SW } = Dimensions.get('window');

// ── Quotes ────────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'Great projects are built one task at a time.', author: 'Planora' },
  { text: 'Fan um naanum perfect nanbarkal.', author: 'Sinthuha' },
  { text: 'Mooditu Project aa seinga', author: 'Planora' },
  { text: 'A goal without a plan is just a wish.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Plans are nothing; planning is everything.', author: 'Dwight D. Eisenhower' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
  { text: 'Productivity is never an accident. It is always the result of commitment.', author: 'Paul J. Meyer' },
  { text: 'Your time is limited — make every sprint count.', author: 'Planora' },
];

// ── Loading Overlay ───────────────────────────────────────────────────────────
function LoadingOverlay() {
  // Top progress bar
  const barAnim = useRef(new Animated.Value(0)).current;
  // Quote fade
  const quoteOp = useRef(new Animated.Value(0)).current;
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  // Animate the progress bar: rushes to 80%, then slowly crawls
  useEffect(() => {
    Animated.sequence([
      Animated.timing(barAnim, { toValue: 0.75, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(barAnim, { toValue: 0.88, duration: 3000, easing: Easing.linear, useNativeDriver: false }),
    ]).start();
  }, [barAnim]);

  // Cycle quotes every 3.5 seconds with fade in/out
  useEffect(() => {
    Animated.timing(quoteOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const interval = setInterval(() => {
      Animated.timing(quoteOp, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [quoteOp]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SW * 0.55] });
  const q = QUOTES[quoteIdx];

  return (
    <View style={sl.wrap}>
      {/* Skeleton cards — faintly visible through the glass */}
      <View style={sl.skelWrap}>
        {[110, 75, 155, 145, 115].map((h, i) => (
          <View key={i} style={s.card}>
            <View style={s.cardInner}><Skeleton h={h} /></View>
          </View>
        ))}
      </View>

      {/* Frosted glass overlay — contains both bar and quote */}
      <View pointerEvents="none" style={sl.glass}>
        <Animated.View style={[sl.loadingContent, { opacity: quoteOp }]}>

          {/* Progress bar 80% width, 20px above quote */}
          <View style={sl.barTrack}>
            <Animated.View style={[sl.bar, { width: barWidth }]}>
              <LinearGradient
                colors={[T.primary + 'AA', T.primary, '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={sl.barTip} />
            </Animated.View>
          </View>

          {/* Quote text centered in glass */}
          <View style={sl.quoteWrap}>
            <Text style={sl.quoteText}>{'"'}{q.text}{'"'}</Text>
            <Text style={sl.quoteAuthor}>— {q.author}</Text>
          </View>

        </Animated.View>
      </View>
    </View>
  );
}


// ── Shared Spin Context — one single loop drives all card borders ──────────────
const SpinContext = createContext(new Animated.Value(0));

function SpinProvider({ children }: { children: React.ReactNode }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 9000, useNativeDriver: true })
    ).start();
  }, [spinAnim]);
  return <SpinContext.Provider value={spinAnim}>{children}</SpinContext.Provider>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(d?: string | null) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; if (m < 1440) return `${Math.floor(m / 60)}h`; return `${Math.floor(m / 1440)}d`;
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── FadeIn ───────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, delay, useNativeDriver: true, tension: 160, friction: 20 }),
    ]).start();
  }, [delay, op, ty]);
  return <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 14, w = '100%' as any, mb = 8 }) {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.4, duration: 650, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.View style={{ height: h, width: w, backgroundColor: '#E8EDF5', borderRadius: 8, marginBottom: mb, opacity: op }} />;
}

// ── Card ─────────────────────────────────────────────────────────────────────
function Card({ title, accent = T.primary, children }: { title: string; accent?: string; children: React.ReactNode }) {
  const spinAnim = useContext(SpinContext);
  const transparent = accent + '00';
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={s.card}>
      <View style={s.cardBorderWrapper}>
        <Animated.View style={[s.cardSpinner, { transform: [{ rotate: spin }] }]}>
          <LinearGradient
            colors={[transparent, transparent, accent, transparent, transparent]}
            locations={[0, 0.35, 0.5, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
      <View style={s.cardInner}>
        <Text style={s.cardTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionLabelText}>{label}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

// ── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({ pct }: { pct: number }) {
  const R = 42, C = 2 * Math.PI * R;
  const anim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1400, useNativeDriver: false }).start();

    // Infinite subtle rotation (40 seconds)
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [anim, pct, rotationAnim]);

  const offset = anim.interpolate({ inputRange: [0, 100], outputRange: [C, 0] });
  const spin = rotationAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const AnimCircle = Animated.createAnimatedComponent(Circle);
  const color = pct >= 100 ? GREEN : pct >= 50 ? T.primary : AMBER;
  const label = pct >= 100 ? 'Complete' : pct >= 70 ? 'On Track' : pct >= 40 ? 'In Progress' : 'At Risk';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: spin }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={R} fill="none" stroke="#EFF3FB" strokeWidth={10} />
            <AnimCircle cx={50} cy={50} r={R} fill="none" stroke={color} strokeWidth={10}
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
          </Svg>
        </Animated.View>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>{Math.round(pct)}%</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>DONE</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>Overall Progress</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color, letterSpacing: -0.5 }}>{label}</Text>
        <View style={{ height: 5, backgroundColor: '#EFF3FB', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
          <Animated.View style={{
            height: 5, borderRadius: 3, backgroundColor: color,
            width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          }} />
        </View>
      </View>
    </View>
  );
}

// ── Metric Tile ───────────────────────────────────────────────────────────────
function MetricTile({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[s.tile, { borderColor: color + '22', backgroundColor: color + '0A' }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -1 }}>{value}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── Activity Item ─────────────────────────────────────────────────────────────
function ActivityItem({ task }: { task: { id: number; title: string; assigneeName?: string; status?: string; updatedAt?: string; assigneePhotoUrl?: string } }) {
  const done = task.status === 'DONE';
  const initials = task.assigneeName?.substring(0, 2).toUpperCase() || '??';
  return (
    <View style={s.listRow}>
      {task.assigneePhotoUrl ? (
        <Image source={{ uri: task.assigneePhotoUrl }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, { backgroundColor: done ? GREEN : T.primary }]}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{initials}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>
          <Text style={{ fontWeight: '700' }}>{task.assigneeName || 'Someone'}</Text>
          <Text style={{ color: '#64748B' }}>{done ? ' completed ' : ' updated '}</Text>
          <Text style={{ color: T.primary }}>TSK-{task.id}</Text>
        </Text>
        <Text style={s.listSub} numberOfLines={1}>{task.title}</Text>
      </View>
      <Text style={s.ago}>{timeAgo(task.updatedAt)}</Text>
    </View>
  );
}

// ── Due Task ──────────────────────────────────────────────────────────────────
function DueItem({ task }: { task: { id: number; title: string; dueDate?: string; assigneeName?: string } }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const diff = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null;
  const urgency = diff === 0 ? RED : diff !== null && diff <= 2 ? AMBER : T.primary;
  const badge = diff === null ? '' : diff === 0 ? 'Today' : `+${diff}d`;
  return (
    <View style={s.listRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={s.listSub}>{task.assigneeName || 'Unassigned'} · TSK-{task.id}</Text>
      </View>
      {badge ? <View style={[s.badge, { backgroundColor: urgency + '18', borderColor: urgency + '30' }]}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: urgency }}>{badge}</Text>
      </View> : null}
    </View>
  );
}

// ── Completed Task ────────────────────────────────────────────────────────────
function CompletedItem({ task, rank }: { task: { id: number; title: string; assigneeName?: string; updatedAt?: string; assigneePhotoUrl?: string }; rank: number }) {
  const initials = task.assigneeName?.substring(0, 2).toUpperCase() || '??';
  return (
    <View style={s.listRow}>
      <Text style={{ fontSize: 12, fontWeight: '900', color: '#64748B', width: 22 }}>#{rank}</Text>
      {task.assigneePhotoUrl ? (
        <Image source={{ uri: task.assigneePhotoUrl }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, { backgroundColor: GREEN }]}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{initials}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={s.listSub}>by {task.assigneeName || 'Someone'} · {timeAgo(task.updatedAt)}</Text>
      </View>
    </View>
  );
}

// ── Milestone Item ────────────────────────────────────────────────────────────
function MilestoneItem({ m }: { m: { id: number; name: string; status: string; dueDate?: string } }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = m.dueDate ? new Date(m.dueDate) : null;
  const diff = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null;
  const overdue = due && due < today && m.status !== 'COMPLETED';
  const c: Record<string, string> = { OPEN: T.primary, IN_PROGRESS: AMBER, COMPLETED: GREEN, CANCELLED: '#94A3B8' };
  const color = c[m.status] || T.primary;
  return (
    <View style={s.listRow}>
      <Text style={{ fontSize: 14 }}>🚩</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>{m.name}</Text>
        <Text style={[s.listSub, overdue ? { color: RED } : null]}>
          {fmtDate(m.dueDate)}{diff !== null ? (overdue ? ` · ${Math.abs(diff)}d overdue` : diff === 0 ? ' · Due today' : ` · In ${diff}d`) : ''}
        </Text>
      </View>
      <View style={[s.badge, { backgroundColor: color + '18', borderColor: color + '30' }]}>
        <Text style={{ fontSize: 12, fontWeight: '800', color }}>{m.status.replace('_', ' ')}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SummaryScreen({
  projectId, projectName, onBack, hideHeader, topOffset,
}: {
  projectId: number;
  projectName?: string;
  onBack?: () => void;
  /** Hide the built-in header when ProjectTopNav is the host */
  hideHeader?: boolean;
  /** Extra paddingTop for ScrollView content to clear the abs-positioned nav bar */
  topOffset?: number;
}) {
  const router = useRouter();
  const { data, milestones, loading, error, refresh, isOnline, isStale } = useProjectSummary(projectId);
  // Defer SVG chart rendering until the navigation slide animation is done
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setChartsReady(true));
    return () => task.cancel();
  }, []);

  const recentActivity = useMemo(() =>
    [...(data?.tasks || [])].filter(t => t.updatedAt)
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()).slice(0, 6),
    [data?.tasks]);

  const dueTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 5);
    return [...(data?.tasks || [])].filter(t => {
      if (!t.dueDate || t.status === 'DONE') return false;
      const d = new Date(t.dueDate); return d >= today && d <= limit;
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5);
  }, [data?.tasks]);

  const completed = useMemo(() =>
    [...(data?.tasks || [])].filter(t => t.status === 'DONE')
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).slice(0, 5),
    [data?.tasks]);

  const upcoming = useMemo(() =>
    [...milestones].filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS')
      .sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); })
      .slice(0, 4),
    [milestones]);

  const pct = data ? (data.metrics.totalTasks > 0 ? (data.metrics.completedTasks / data.metrics.totalTasks) * 100 : 0) : 0;
  const isAgile = data?.isAgile ?? false;
  const displayName = projectName || data?.projectDetails?.name || 'Summary';

  return (
    <SpinProvider>
      <SafeAreaView style={s.safe} edges={hideHeader ? [] : ['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <OfflineStaleBanner isOnline={isOnline} isStale={isStale} />

        {/* Built-in Header — hidden when ProjectTopNav is the host */}
        {!hideHeader && (
          <View style={s.header}>
            {onBack && (
              <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M19 12H5M12 5l-7 7 7 7" />
                </Svg>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle} numberOfLines={1}>{displayName}</Text>
              <Text style={s.headerSub}>Project Overview{isAgile ? ' · Agile' : ''}</Text>
            </View>
            {!isAgile && (
              <TouchableOpacity 
                style={s.boardBtn} 
                onPress={() => router.push(`/board/${projectId}`)}
                activeOpacity={0.7}
              >
                <Text style={s.boardBtnText}>Board</Text>
              </TouchableOpacity>
            )}
            {isAgile && (
              <View style={s.agilePill}>
                <Text style={s.agilePillText}>AGILE</Text>
              </View>
            )}
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, topOffset ? { paddingTop: topOffset } : undefined]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={T.primary} colors={[T.primary]} />}
        >
          {loading ? (
            <LoadingOverlay />
          ) : error ? (
            <View style={s.errorBox}>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={refresh}>
                <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 1. Progress */}
              <FadeIn delay={0}>
                <Card title="OVERALL PROGRESS">
                  <CircularProgress pct={pct} />
                </Card>
              </FadeIn>

              {/* 2. Metrics */}
              <FadeIn delay={60}>
                <View style={s.tileRow}>
                  <MetricTile label="Total" value={data!.metrics.totalTasks} color={T.primary} icon="📋" />
                  <MetricTile label="Done" value={data!.metrics.completedTasks} color={GREEN} icon="✅" />
                  <MetricTile label="Overdue" value={data!.metrics.overdueTasks} color={RED} icon="⚠️" />
                </View>
              </FadeIn>

              {/* 3. Priority Donut */}
              <FadeIn delay={120}>
                <SectionLabel label="Analytics" />
                <Card title="TASK PRIORITY" accent="#8B5CF6">
                  <DonutPriorityChart tasks={data!.tasks} />
                </Card>
              </FadeIn>

              {/* 4–7. Agile Charts — deferred until interaction is done */}
              {isAgile && chartsReady && (
                <>
                  {/* Current Sprint — shown first in Planning section */}
                  <FadeIn delay={155}>
                    <SectionLabel label="Current Sprint" />
                    <Card title="ACTIVE SPRINT" accent={T.primary}>
                      <CurrentSprintCard tasks={data!.tasks} sprints={data!.sprints} />
                    </Card>
                  </FadeIn>

                  <FadeIn delay={175}>
                    <SectionLabel label="Analytics" />
                    <Card title="SPRINT BURNDOWN" accent={T.primary}>
                      <BurndownLineChart tasks={data!.tasks} sprints={data!.sprints} />
                    </Card>
                  </FadeIn>
                  <FadeIn delay={200}>
                    <Card title="SPRINT VELOCITY" accent={GREEN}>
                      <VelocityBarChart tasks={data!.tasks} sprints={data!.sprints} />
                    </Card>
                  </FadeIn>
                  <FadeIn delay={240}>
                    <Card title="LEAD TIME" accent={AMBER}>
                      <LeadTimeChart tasks={data!.tasks} />
                    </Card>
                  </FadeIn>
                </>
              )}

              {/* 7. Activity */}
              <FadeIn delay={280}>
                <SectionLabel label="Activity" />
                <Card title="RECENT ACTIVITY">
                  {recentActivity.length === 0
                    ? <Text style={s.empty}>No recent activity</Text>
                    : recentActivity.map(t => <ActivityItem key={t.id} task={t} />)}
                </Card>
              </FadeIn>

              {/* 8. Due Soon */}
              <FadeIn delay={320}>
                <Card title="DUE IN 5 DAYS" accent={RED}>
                  {dueTasks.length === 0
                    ? <Text style={s.empty}>No upcoming deadlines 🎉</Text>
                    : dueTasks.map(t => <DueItem key={t.id} task={t} />)}
                </Card>
              </FadeIn>

              {/* 9. Completed */}
              <FadeIn delay={360}>
                <Card title="RECENTLY COMPLETED" accent={GREEN}>
                  {completed.length === 0
                    ? <Text style={s.empty}>No completed tasks yet</Text>
                    : completed.map((t, i) => <CompletedItem key={t.id} task={t} rank={i + 1} />)}
                </Card>
              </FadeIn>

              {/* 10. Milestones */}
              <FadeIn delay={400}>
                <SectionLabel label="Planning" />
                <Card title="UPCOMING MILESTONES" accent={AMBER}>
                  {upcoming.length === 0
                    ? <Text style={s.empty}>No upcoming milestones</Text>
                    : upcoming.map(m => <MilestoneItem key={m.id} m={m} />)}
                </Card>
              </FadeIn>

              {/* 11. Workload Distribution */}
              <FadeIn delay={440}>
                <Card title="WORKLOAD DISTRIBUTION" accent="#8B5CF6">
                  <WorkloadCard projectId={projectId} tasks={data!.tasks} />
                </Card>
              </FadeIn>

              {/* 12. Project Notes */}
              <FadeIn delay={480}>
                <Card title="PROJECT NOTES" accent={AMBER}>
                  <ProjectNotesCard
                    projectId={projectId}
                    defaultNote={data?.projectDetails?.description || ''}
                  />
                </Card>
              </FadeIn>

              <View style={{ height: 120 }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SpinProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16,
    paddingTop: 6, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 1 },
  agilePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: T.primaryLight, borderWidth: 1, borderColor: T.primaryMuted + '55',
  },
  agilePillText: { fontSize: 12, fontWeight: '800', color: T.primary, letterSpacing: 0.5 },
  boardBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: T.primary, borderWidth: 1, borderColor: T.primary,
  },
  boardBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  scroll: { padding: 16, gap: 12 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 24, marginBottom: 14, paddingHorizontal: 4,
  },
  sectionLabelText: {
    fontSize: 12, fontWeight: '800', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  sectionLine: {
    flex: 1, height: 1, backgroundColor: '#E2E8F0', borderRadius: 1,
  },
  card: {
    backgroundColor: '#E2E8F0', borderRadius: 18, padding: 1.5,
    ...Platform.select({
      ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  cardBorderWrapper: { ...StyleSheet.absoluteFillObject, borderRadius: 18, overflow: 'hidden' },
  cardSpinner: { position: 'absolute', top: -500, left: -500, right: -500, bottom: -500 },
  cardInner: { backgroundColor: '#FFFFFF', borderRadius: 16.5, padding: 18, gap: 14 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 4 },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.8, borderBottomColor: '#F8FAFC',
  },
  listTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  listSub: { fontSize: 12, fontWeight: '500', color: '#64748B', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ago: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  empty: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  errorBox: { margin: 20, padding: 24, backgroundColor: '#FEF2F2', borderRadius: 18, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 13, color: '#DC2626', textAlign: 'center', fontWeight: '600' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: T.primary, backgroundColor: T.primaryLight },
});

// ── Loading Overlay Styles ─────────────────────────────────────────────────────
const sl = StyleSheet.create({
  wrap: { flex: 1, minHeight: 500 },

  // Skeleton sits below the glass
  skelWrap: { gap: 14, paddingTop: 4 },

  // Full-screen frosted glass on top of skeletons
  glass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,248,250,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Center wrapper
  loadingContent: { width: '100%', alignItems: 'center', justifyContent: 'center' },

  // Progress bar track (55% width, compact & professional)
  barTrack: {
    width: '55%', height: 3,
    backgroundColor: '#E2E8F0', borderRadius: 3,
    marginBottom: 20, overflow: 'hidden',
  },
  bar: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 3 },
  barTip: {
    position: 'absolute', right: 0, top: -4,
    width: 16, height: 11, borderRadius: 8,
    backgroundColor: '#93C5FD', opacity: 0.9,
  },

  // Quote block
  quoteWrap: { alignItems: 'center', paddingHorizontal: 36, gap: 10 },
  quoteText: {
    fontSize: 17, fontWeight: '600', color: '#0F172A',
    textAlign: 'center', lineHeight: 28, fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12, fontWeight: '700', color: T.primary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
});
