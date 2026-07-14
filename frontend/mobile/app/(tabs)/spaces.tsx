import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useDashboard, type ProjectSummary } from '@/src/hooks/useDashboard';
import { getStripeColor, T } from '@/src/constants/tokens';
import { StateView } from '@/src/components/ui/StateView';

type SpaceFilter = 'recent' | 'favorites';

function normalizeFilter(value: unknown): SpaceFilter {
  return value === 'favorites' ? 'favorites' : 'recent';
}

function SpaceCard({
  project,
  onFavoriteToggle,
  onRecordAccess,
}: {
  project: ProjectSummary;
  onFavoriteToggle: (id: number) => Promise<void>;
  onRecordAccess: (id: number) => Promise<void>;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(!!project.isFavorite);
  const isAgile = project.type !== 'KANBAN';

  const openProject = async () => {
    await onRecordAccess(project.id);
    router.push(`/summary/${project.id}` as never);
  };

  const toggleFavorite = async () => {
    setFavorite((value) => !value);
    try {
      await onFavoriteToggle(project.id);
    } catch {
      setFavorite((value) => !value);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
      onPress={openProject}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.cardStripe, { backgroundColor: getStripeColor(project.name || String(project.id)) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.projectIcon}>
            <Ionicons name={isAgile ? 'git-branch-outline' : 'grid-outline'} size={17} color={T.primary} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? `Remove ${project.name} from favorites` : `Add ${project.name} to favorites`}
            accessibilityState={{ selected: favorite }}
            onPress={toggleFavorite}
            hitSlop={10}
            style={styles.favoriteButton}
          >
            <Ionicons name={favorite ? 'star' : 'star-outline'} size={18} color={favorite ? '#F5A623' : '#94A3B8'} />
          </Pressable>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{project.name}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.projectKey} numberOfLines={1}>
            {(project.projectKey || project.name.slice(0, 4)).toUpperCase()}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: isAgile ? '#EEF2FF' : '#ECFDF5' }]}>
            <Text style={[styles.typeBadgeText, { color: isAgile ? '#4F46E5' : '#059669' }]}>
              {isAgile ? 'Agile' : 'Kanban'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function SpacesScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = normalizeFilter(params.filter);
  const [filter, setFilter] = useState<SpaceFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const {
    projects,
    loadingProjects,
    refreshProjects,
    toggleFavorite,
    recordAccess,
  } = useDashboard();

  const items = useMemo(() => {
    const source = filter === 'favorites' ? projects.favorites : projects.recent;
    const unique = Array.from(new Map(source.map((project) => [project.id, project])).values());
    const query = search.trim().toLowerCase();

    if (!query) {
      return unique;
    }

    return unique.filter((project) => (
      project.name.toLowerCase().includes(query) ||
      (project.projectKey || '').toLowerCase().includes(query)
    ));
  }, [filter, projects.favorites, projects.recent, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Workspace</Text>
          <Text style={styles.title}>Spaces</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color="#94A3B8" />
          <TextInput
            accessibilityLabel="Search spaces"
            value={search}
            onChangeText={setSearch}
            placeholder="Search spaces"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <View style={styles.segmented}>
          {(['recent', 'favorites'] as SpaceFilter[]).map((item) => {
            const active = filter === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityLabel={item === 'recent' ? 'Recent spaces' : 'Favorite spaces'}
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item)}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {item === 'recent' ? 'Recent' : 'Favorites'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loadingProjects} onRefresh={refreshProjects} tintColor={T.primary} colors={[T.primary]} />
        }
      >
        {loadingProjects && items.length === 0 ? (
          <StateView loading title="Loading spaces" />
        ) : items.length === 0 ? (
          <StateView
            title="No spaces found"
            message={search ? 'Try a different search term.' : 'Recently opened and favorite spaces will appear here.'}
          />
        ) : (
          items.map((project) => (
            <SpaceCard
              key={project.id}
              project={project}
              onFavoriteToggle={toggleFavorite}
              onRecordAccess={recordAccess}
            />
          ))
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  eyebrow: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 3,
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0,
  },
  countBadge: {
    minWidth: 38,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(21,93,252,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countText: {
    color: T.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  controls: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  searchBox: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    color: '#0F172A',
    fontSize: 14,
  },
  segmented: {
    height: 38,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: T.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    minHeight: 118,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardStripe: {
    width: 7,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(21,93,252,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  projectKey: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  centerState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    minHeight: 260,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 5,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  bottomPad: {
    height: 104,
  },
});
