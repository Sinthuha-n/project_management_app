import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Pressable, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { ProjectSummary } from '../../hooks/useDashboard';

// ─── Color stripe helper (same algorithm as web) ─────────────────────────────
const STRIPE_COLORS = [
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
];

function getStripeColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STRIPE_COLORS[Math.abs(hash) % STRIPE_COLORS.length];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectSummary;
  onFavoriteToggle: (id: number) => Promise<void>;
  onRecordAccess: (id: number) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectCard({ project, onFavoriteToggle, onRecordAccess }: ProjectCardProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(!!project.isFavorite);
  const stripeColor = getStripeColor(project.name || String(project.id));
  const isAgile = project.type !== 'KANBAN';
  const displaySubtext = `${project.projectKey || project.name.substring(0, 4)} • ${isAgile ? 'Agile' : 'Kanban'}`.toUpperCase();

  const handleOpen = async () => {
    await onRecordAccess(project.id);
    router.push(`/summary/${project.id}` as never);
  };

  const handleFavorite = async () => {
    setIsFavorite(v => !v);
    try {
      await onFavoriteToggle(project.id);
    } catch {
      setIsFavorite(v => !v); // rollback
    }
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Color stripe */}
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.topRow}>
          <Text style={styles.subtext} numberOfLines={1}>{displaySubtext}</Text>
          <TouchableOpacity onPress={handleFavorite} hitSlop={8} style={styles.starBtn}>
            <Text style={[styles.star, isFavorite && styles.starActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Project name */}
        <Text style={styles.name} numberOfLines={2}>{project.name}</Text>

        {/* Footer: type badge + open */}
        <View style={styles.footer}>
          <View style={[styles.badge, { backgroundColor: isAgile ? '#EEF2FF' : '#ECFDF5' }]}>
            <Text style={[styles.badgeText, { color: isAgile ? '#4F46E5' : '#059669' }]}>
              {isAgile ? 'Sprint' : 'Kanban'}
            </Text>
          </View>
          <View style={styles.openBtn}>
            <Text style={styles.openBtnText}>OPEN →</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    width: 220,
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginRight: 12,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }
      : {}),
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  stripe: {
    width: 7,
  },
  content: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtext: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    flex: 1,
    marginRight: 4,
  },
  starBtn: {
    padding: 2,
  },
  star: {
    fontSize: 16,
    color: '#CBD5E1',
  },
  starActive: {
    color: '#F59E0B',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    flex: 1,
    marginVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  openBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  openBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
});
