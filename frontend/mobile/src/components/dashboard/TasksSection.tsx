import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Pressable, Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import StatusDonutChart from './StatusDonutChart';
import { STATUS_MAP, STATUS_LABELS, StatusKey } from '../../constants/tokens';
import type { DashboardItem, TabItemsByKey, TabKey, TabLoadingByKey } from '../../hooks/useDashboard';

// ─── Tab definitions ────────────────────────────────────────────────────────────

type DashboardTab = { id: TabKey; label: string };

const EMPTY_MESSAGES: Record<string, string> = {
  'worked-on':      "You haven't modified any tasks recently.",
  'viewed':         "You haven't viewed any boards or tasks recently.",
  'assigned-to-me': 'You have no assigned tasks. Take a break!',
  'favorites':      "You haven't favored any projects yet.",
  'boards':         'No boards found.',
};

// ─── Skeleton Row ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[rowStyles.row, { opacity: anim }]}>
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#E5E7EB' }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: '60%', height: 12, borderRadius: 4, backgroundColor: '#E5E7EB' }} />
        <View style={{ width: '40%', height: 10, borderRadius: 4, backgroundColor: '#E5E7EB' }} />
      </View>
    </Animated.View>
  );
}

// ─── Item Icons ─────────────────────────────────────────────────────────────────

function TaskIcon() {
  return (
    <View style={[iconStyles.wrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={10} opacity={0.2} />
        <Path d="M9 12l2 2 4-4" />
      </Svg>
    </View>
  );
}

function KanbanIcon() {
  return (
    <View style={[iconStyles.wrap, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={3} width={18} height={18} rx={2} opacity={0.3} />
        <Path d="M8 7v9" strokeWidth={3} />
        <Path d="M16 7v6" strokeWidth={3} />
      </Svg>
    </View>
  );
}

function AgileIcon() {
  return (
    <View style={[iconStyles.wrap, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </Svg>
    </View>
  );
}

function BoardIcon() {
  return (
    <View style={[iconStyles.wrap, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={3} width={18} height={18} rx={2} opacity={0.3} />
        <Line x1={9} y1={3} x2={9} y2={21} opacity={0.3} />
        <Line x1={15} y1={3} x2={15} y2={21} opacity={0.3} />
        <Path d="M5 8h2" strokeWidth={3} />
        <Path d="M11 10h2" strokeWidth={3} />
        <Path d="M17 14h2" strokeWidth={3} />
      </Svg>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});

function ItemIcon({ item }: { item: DashboardItem }) {
  if (item.type === 'TASK')           return <TaskIcon />;
  if (item.type === 'PROJECT_KANBAN') return <KanbanIcon />;
  if (item.type === 'PROJECT_AGILE')  return <AgileIcon />;
  if (item.type === 'BOARD')          return <BoardIcon />;
  return <View style={[iconStyles.wrap, { backgroundColor: '#FEF3C7' }]} />;
}

// ─── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as StatusKey] ?? STATUS_MAP.TODO;
  const label = STATUS_LABELS[status as StatusKey] ?? status;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={[badgeStyles.dot, { backgroundColor: s.dot }]} />
      <Text style={[badgeStyles.label, { color: s.text }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 100,
  },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ activeTab, searchQuery }: { activeTab: string; searchQuery: string }) {
  const message = searchQuery
    ? 'No results found for your search.'
    : (EMPTY_MESSAGES[activeTab] ?? 'Nothing to show here.');
  return (
    <View style={emptyStyles.wrap}>
      <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.5} strokeLinecap="round">
        <Circle cx={12} cy={12} r={10} />
        <Path d="M8 12h8" />
      </Svg>
      <Text style={emptyStyles.text}>{message}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  text: { fontSize: 13.5, fontWeight: '500', color: '#9CA3AF', textAlign: 'center' },
});

// ─── Table Row ──────────────────────────────────────────────────────────────────

function TableRow({ item, activeTab, onPress }: { item: DashboardItem; activeTab: string; onPress: () => void }) {
  const isAssigned = activeTab === 'assigned-to-me';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,     useNativeDriver: true, speed: 50 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[rowStyles.row, { transform: [{ scale: scaleAnim }] }]}>
        {!isAssigned && (
          <View style={rowStyles.iconCell}>
            <ItemIcon item={item} />
          </View>
        )}
        <View style={rowStyles.nameCell}>
          <Text style={rowStyles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={rowStyles.location} numberOfLines={1}>{item.location}</Text>
        </View>
        {isAssigned && item.type === 'TASK' && item.status && (
          <View style={rowStyles.statusCell}>
            <StatusBadge status={item.status} />
          </View>
        )}
        {/* Subtle chevron */}
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 18l6-6-6-6" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

// ─── Staggered Row Wrapper ────────────────────────────────────────────────────

function AnimatedRow({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        delay: index * 40,
        useNativeDriver: true,
        tension: 200,
        friction: 22,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.8,
    borderBottomColor: '#F1F5F9',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  iconCell:   { width: 34 },
  nameCell:   { flex: 1, gap: 2 },
  name:       { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  location:   { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.7 },
  statusCell: { flexShrink: 0 },
});

// ─── Dashboard Section — light glassmorphism card ───────────────────────────────
// Each section is a frosted-white card with a subtle blue top-accent,
// and the table inside is a fixed-height ScrollView (no Show More button).

function DashboardSection({
  title, tabs, activeTab, onTabChange, assignedCount,
  items, loading, searchQuery,
}: {
  title: string;
  tabs: DashboardTab[];
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
  assignedCount?: number;
  items: DashboardItem[];
  loading: boolean;
  searchQuery: string;
}) {
  const router = useRouter();

  const filteredItems = items.filter(i => {
    if (i.type === 'TASK' && i.status === 'DONE') return false;
    return true;
  });

  const handleRowPress = (item: DashboardItem) => {
    if (item.type === 'TASK') return;
    router.push(`/summary/${item.realId}` as never);
  };

  return (
    <View style={cardStyles.card}>
      {/* Blue top accent bar */}
      <View style={cardStyles.accentBar} />

      {/* Header */}
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.title}>{title}</Text>
          {title === 'Assigned to me' && assignedCount !== undefined && (
            <View style={cardStyles.countPill}>
              <Text style={cardStyles.countText}>{assignedCount} pending</Text>
            </View>
          )}
        </View>
        {/* Total count badge */}
        {!loading && filteredItems.length > 0 && (
          <View style={cardStyles.totalBadge}>
            <Text style={cardStyles.totalBadgeText}>{filteredItems.length}</Text>
          </View>
        )}
      </View>

      {/* Tab switcher */}
      {tabs.length > 1 && (
        <View style={cardStyles.tabRow}>
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[cardStyles.tab, isActive && cardStyles.tabActive]}
                onPress={() => onTabChange(t.id)}
                activeOpacity={0.75}
              >
                <Text style={[cardStyles.tabText, isActive && cardStyles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Donut Chart for Assigned To Me */}
      {activeTab === 'assigned-to-me' && filteredItems.length > 0 && !loading && (
        <View style={{ marginBottom: 12 }}>
          <StatusDonutChart items={filteredItems} />
        </View>
      )}

      {/* Scrollable table — no Show More, user scrolls inside */}
      <View style={cardStyles.tableWrapper}>
        {/* Table column headers */}
        {!loading && filteredItems.length > 0 && (
          <View style={cardStyles.tableHeader}>
            {activeTab === 'assigned-to-me' ? (
              <>
                <Text style={cardStyles.th}>Task Name</Text>
                <Text style={[cardStyles.th, { textAlign: 'right', marginRight: 16 }]}>Status</Text>
              </>
            ) : (
              <>
                <View style={{ width: 34 }} />
                <Text style={[cardStyles.th, { flex: 1 }]}>
                  {activeTab === 'boards' ? 'Board Name' : activeTab === 'favorites' ? 'Project' : 'Name'}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Rows — max ~4 rows visible, then scrollable */}
        {loading ? (
          <View>
            {[0, 1, 2].map(i => <SkeletonRow key={i} />)}
          </View>
        ) : filteredItems.length === 0 ? (
          <EmptyState activeTab={activeTab} searchQuery={searchQuery} />
        ) : (
          <ScrollView
            style={cardStyles.scrollArea}
            showsVerticalScrollIndicator={true}
            indicatorStyle="black"
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 2 }}
          >
            {filteredItems.map((item, index) => (
              <AnimatedRow key={item.id} index={index}>
                <TableRow
                  item={item}
                  activeTab={activeTab}
                  onPress={() => handleRowPress(item)}
                />
              </AnimatedRow>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ~4 rows visible (each row ≈ 56px)
const TABLE_MAX_HEIGHT = 224;

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  // Blue-to-indigo accent strip at the top of each card
  accentBar: {
    height: 3,
    backgroundColor: '#155DFC',
    // Mimics a subtle gradient strip using opacity trick
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#101828',
    letterSpacing: 0.1,
  },
  countPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 99,
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0052CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalBadge: {
    minWidth: 24, height: 24, borderRadius: 99,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  totalBadgeText: {
    fontSize: 10.5, fontWeight: '700', color: '#64748B',
  },
  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(241,245,249,0.7)',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  tabText: {
    fontSize: 11, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tabTextActive: { color: '#155DFC' },

  // Inner table wrapper
  tableWrapper: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FAFBFF',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 0.8,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 12,
    alignItems: 'center',
  },
  th: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  // Fixed-height scroll area — shows ~4 rows, user scrolls for more
  scrollArea: {
    maxHeight: TABLE_MAX_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
});

// ─── Main exported component ────────────────────────────────────────────────────

interface TasksSectionProps {
  itemsByTab: TabItemsByKey;
  loadingTabs: TabLoadingByKey;
  assignedCount: number;
  onTabChange: (tab: TabKey) => void;
}

export default function TasksSection({
  itemsByTab, loadingTabs, assignedCount, onTabChange,
}: TasksSectionProps) {
  const router = useRouter();
  const [secondaryTab, setSecondaryTab] = useState<TabKey>('worked-on');
  const [tertiaryTab, setTertiaryTab]   = useState<TabKey>('favorites');

  return (
    <View style={outerStyles.container}>

      {/* ── Create new project button ── */}
      <TouchableOpacity
        style={outerStyles.createBtn}
        onPress={() => router.push('/create-project' as never)}
        activeOpacity={0.85}
      >
        <Text style={outerStyles.createBtnText}>+ Create new project</Text>
      </TouchableOpacity>

      {/* ── Section 1: Assigned to me ── */}
      <DashboardSection
        title="Assigned to me"
        tabs={[{ id: 'assigned-to-me', label: 'Assigned to me' }]}
        activeTab="assigned-to-me"
        onTabChange={onTabChange}
        assignedCount={assignedCount}
        items={itemsByTab['assigned-to-me']}
        loading={loadingTabs['assigned-to-me']}
        searchQuery=""
      />

      {/* ── Section 2: Recent Activity ── */}
      <DashboardSection
        title="Recent Activity"
        tabs={[
          { id: 'worked-on', label: 'Worked on' },
          { id: 'viewed',    label: 'Viewed'    },
        ]}
        activeTab={secondaryTab}
        onTabChange={(t) => { setSecondaryTab(t); onTabChange(t); }}
        items={itemsByTab[secondaryTab]}
        loading={loadingTabs[secondaryTab]}
        searchQuery=""
      />

      {/* ── Section 3: Quick Access ── */}
      <DashboardSection
        title="Quick Access"
        tabs={[
          { id: 'favorites', label: 'Favorites' },
          { id: 'boards',    label: 'Boards'    },
        ]}
        activeTab={tertiaryTab}
        onTabChange={(t) => { setTertiaryTab(t); onTabChange(t); }}
        items={itemsByTab[tertiaryTab]}
        loading={loadingTabs[tertiaryTab]}
        searchQuery=""
      />
    </View>
  );
}

const outerStyles = StyleSheet.create({
  container: {
    gap: 20,
  },
  createBtn: {
    marginHorizontal: 16,
    backgroundColor: '#0052CC',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0052CC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
    }),
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
