import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Pressable, Platform, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { T, getStripeColor } from '../../constants/tokens';
import type { ProjectSummary } from '../../hooks/useDashboard';

// ─── Search Icon SVG (mirrors web: svg width="14" circle cx="11" cy="11" r="8") ──

function SearchIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

// ─── Star Icon (mirrors web: polygon points="12 2 15.09...") ─────────────────

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={filled ? '#F5A623' : 'transparent'} stroke={filled ? '#F5A623' : '#CBD5E1'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

// ─── Arrow Right Icon (mirrors web view-all card ArrowRight) ─────────────────

function ArrowRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14M12 5l7 7-7 7" />
    </Svg>
  );
}

// ─── Skeleton card (mirrors web: animate-pulse gray shimmer) ─────────────────

function SkeletonCard() {
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
    <Animated.View style={[skeletonStyles.card, { opacity: anim }]}>
      <View style={skeletonStyles.row}>
        <View style={skeletonStyles.iconBox} />
        <View style={skeletonStyles.line1} />
      </View>
      <View style={skeletonStyles.line2} />
      <View style={skeletonStyles.footer}>
        <View style={skeletonStyles.lineShort} />
        <View style={skeletonStyles.lineShort} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    width: 240, height: 160, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    padding: 20, marginRight: 16, justifyContent: 'space-between',
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#E5E7EB' },
  line1: { width: 80, height: 12, borderRadius: 4, backgroundColor: '#E5E7EB' },
  line2: { width: '66%', height: 20, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  lineShort: { width: 48, height: 12, borderRadius: 4, backgroundColor: '#E5E7EB' },
});

// ─── Project Card (exact mirror of web RecentProjectCard.tsx) ─────────────────

interface ProjectCardProps {
  project: ProjectSummary;
  onFavoriteToggle: (id: number) => Promise<void>;
  onRecordAccess: (id: number) => Promise<void>;
}

function ProjectCard({ project, onFavoriteToggle, onRecordAccess }: ProjectCardProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(!!project.isFavorite);
  const stripeColor = getStripeColor(project.name || String(project.id));
  const isAgile = project.type !== 'KANBAN';
  // matches web: `${projectKey} • ${isAgileProject ? 'Agile' : 'Kanban'}`.toUpperCase()
  const displaySubtext = `${project.projectKey || project.name.substring(0, 4)} • ${isAgile ? 'AGILE' : 'KANBAN'}`;

  const handleOpen = async () => {
    await onRecordAccess(project.id);
    router.push(`/summary/${project.id}` as never);
  };

  const handleFavorite = async () => {
    setIsFavorite(v => !v);
    try { await onFavoriteToggle(project.id); }
    catch { setIsFavorite(v => !v); }
  };

  return (
    // mirrors: group flex flex-row min-w-[260px] max-w-[260px] h-[160px] bg-white rounded-2xl
    // shadow border cursor-pointer transition hover:shadow-blue hover:-translate-y-[3px]
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [cardStyles.card, pressed && cardStyles.cardPressed]}
    >
      {/* Vertical color stripe — bg-[color] w-[8px] h-full */}
      <View style={[cardStyles.stripe, { backgroundColor: stripeColor }]} />

      {/* Content Container — flex flex-col flex-1 py-4 pr-5 pl-4 */}
      <View style={cardStyles.content}>

        {/* Header: Key label + Star */}
        <View style={cardStyles.topRow}>
          {/* font-arimo text-[11px] font-bold text-[#94a3b8] tracking-[0.05em] uppercase */}
          <Text style={cardStyles.subtext} numberOfLines={1}>{displaySubtext}</Text>

          {/* Star — p-1.5 rounded-full hover:bg-amber-50 */}
          <TouchableOpacity onPress={handleFavorite} hitSlop={8} style={cardStyles.starBtn}>
            <StarIcon filled={isFavorite} />
          </TouchableOpacity>
        </View>

        {/* Project Title — font-arimo text-[15px] font-bold text-[#0f172a] line-clamp-2 */}
        <Text style={cardStyles.name} numberOfLines={2}>{project.name}</Text>

        {/* Footer: action buttons + OPEN badge */}
        <View style={cardStyles.footer}>
          {/* Board type indicator */}
          <View style={[cardStyles.typeBadge, { backgroundColor: isAgile ? '#EEF2FF' : '#ECFDF5' }]}>
            <Text style={[cardStyles.typeBadgeText, { color: isAgile ? '#4F46E5' : '#059669' }]}>
              {isAgile ? 'Sprint' : 'Kanban'}
            </Text>
          </View>

          {/* OPEN badge — mirrors web: px-2.5 py-1 rounded-md bg-slate-50 border group-hover:bg-blue-600 */}
          <View style={cardStyles.openBadge}>
            <Text style={cardStyles.openBadgeText}>OPEN</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    // min-w-[260px] max-w-[260px] h-[160px] bg-white rounded-2xl
    flexDirection: 'row',
    width: 240,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginRight: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
    }),
    elevation: 3,
  },
  cardPressed: {
    // active:scale-[0.98]
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  stripe: {
    width: 8,   // w-[8px]
  },
  content: {
    flex: 1,
    paddingTop: 16, paddingBottom: 16,
    paddingRight: 20, paddingLeft: 16,  // py-4 pr-5 pl-4
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subtext: {
    // font-arimo text-[11px] font-bold text-[#94a3b8] tracking-[0.05em] uppercase
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 4,
  },
  starBtn: {
    padding: 4,
    borderRadius: 999,
    marginTop: -2,
    marginRight: -4,
  },
  name: {
    // font-arimo text-[15px] font-bold text-[#0f172a] line-clamp-2
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  openBadge: {
    // px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  openBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
});

// ─── View-All trailing card (mirrors web: dashed border ArrowRight card) ─────

function ViewAllCard({ count }: { count: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/spaces' as never)}
      style={({ pressed }) => [viewAllStyles.card, pressed && viewAllStyles.pressed]}
    >
      <View style={viewAllStyles.iconCircle}>
        <ArrowRightIcon />
      </View>
      <Text style={viewAllStyles.label}>View all spaces</Text>
      {count > 5 && (
        <Text style={viewAllStyles.extra}>+{count - 5} more</Text>
      )}
    </Pressable>
  );
}

const viewAllStyles = StyleSheet.create({
  card: {
    width: 180, height: 160,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginRight: 8,
  },
  pressed: { opacity: 0.8 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  extra: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
});

// ─── RecentSpacesSection (main export) ───────────────────────────────────────

type FilterTab = 'recent' | 'favorites';

interface RecentSpacesSectionProps {
  projects: { recent: ProjectSummary[]; favorites: ProjectSummary[] };
  loading: boolean;
  onFavoriteToggle: (id: number) => Promise<void>;
  onRecordAccess: (id: number) => Promise<void>;
}

export default function RecentSpacesSection({
  projects, loading, onFavoriteToggle, onRecordAccess,
}: RecentSpacesSectionProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('recent');
  const [search, setSearch]  = useState('');

  const source = filter === 'recent' ? projects.recent : projects.favorites;
  const unique  = Array.from(new Map(source.map(p => [p.id, p])).values());
  const filtered = unique.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectKey ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* ── Section Header ──────────────────────────────────────────────────── */}
      {/* mirrors: flex justify-between items-center w-full md:w-auto px-1 h-5 */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Recent spaces</Text>
        {/* "View all" — md:hidden on desktop, always shown on mobile */}
        <TouchableOpacity onPress={() => router.push('/spaces' as never)}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>

      {/* ── Controls: search + Recent/Favourites tabs ────────────────────── */}
      {/* mirrors: flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 */}
      <View style={styles.controlsRow}>

        {/* Search box — mirrors: relative w-full sm:w-[220px] with search icon */}
        <View style={styles.searchBox}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Tab switcher — mirrors: flex items-center bg-gray-100/50 p-1 rounded-lg gap-1 */}
        <View style={styles.tabGroup}>
          {(['recent', 'favorites'] as FilterTab[]).map(t => {
            const isActive = filter === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setFilter(t)}
              >
                {/* font-outfit text-[11px] font-bold uppercase tracking-wider */}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {t === 'recent' ? 'Recent' : 'Favourites'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Carousel ─────────────────────────────────────────────────────── */}
      {/* mirrors: flex gap-4 overflow-x-auto pb-4 pt-2 px-1 hide-scrollbar */}
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {search
              ? `No results for "${search}"`
              : 'No spaces found for this tab'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {/* up to 5 cards + trailing View-All card */}
          {filtered.slice(0, 5).map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onFavoriteToggle={onFavoriteToggle}
              onRecordAccess={onRecordAccess}
            />
          ))}
          <ViewAllCard count={filtered.length} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  // mirrors: flex justify-between items-center w-full px-1 h-5
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    // font-outfit text-[15px] font-bold text-[#101828]
    fontSize: 15,
    fontWeight: '700',
    color: '#101828',
  },
  viewAll: {
    // font-outfit text-[13px] font-bold text-[#0052CC]
    fontSize: 13,
    fontWeight: '700',
    color: '#0052CC',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  // mirrors: relative w-full sm:w-[220px] border border-[#E5E7EB] rounded-[6px] bg-white
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 34,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    paddingVertical: 0,
  },
  // mirrors: flex items-center bg-gray-100/50 p-1 rounded-lg gap-1
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(243,244,246,0.5)',
    padding: 4,
    borderRadius: 8,
    gap: 4,
  },
  // mirrors: flex-1 sm:flex-none px-3 py-1.5 rounded-[6px] font-outfit text-[11px] font-bold uppercase tracking-wider
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabActive: {
    // bg-white text-[#0052CC] shadow-sm border border-gray-200/60
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabTextActive: {
    color: '#0052CC',
  },
  carousel: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyState: {
    // w-full py-8 text-center bg-gray-50 rounded border border-dashed border-gray-300
    marginHorizontal: 16,
    paddingVertical: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6A7282',
    fontWeight: '500',
  },
});
