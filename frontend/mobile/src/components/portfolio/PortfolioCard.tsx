import React, { useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Portfolio } from '../../services/portfolio-service';

function healthConfig(score: number) {
  if (score >= 75) return { label: 'Healthy', color: '#34D399' };
  if (score >= 50) return { label: 'At Risk', color: '#FBBF24' };
  return { label: 'Critical', color: '#F87171' };
}

interface Props {
  portfolio: Portfolio;
  onPress?: () => void;
}

export default function PortfolioCard({ portfolio, onPress }: Props) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const score = portfolio.healthScore ?? 100;
  const hc = healthConfig(score);
  const completionPct = portfolio.totalTasks
    ? Math.round(((portfolio.completedTasks ?? 0) / portfolio.totalTasks) * 100)
    : 0;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 400, friction: 14 }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 240, friction: 16 }).start();
  }, [scale]);

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push(`/portfolios/${portfolio.id}` as never);
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        style={styles.card}
      >
        {/* Glass background */}
        <View style={[styles.glassBase, Platform.OS === 'ios' ? styles.iosShadow : styles.androidShadow]} />

        {/* Color accent top bar */}
        <View style={[styles.accentBar, { backgroundColor: portfolio.color }]} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {portfolio.emoji ? (
                <Text style={styles.emoji}>{portfolio.emoji}</Text>
              ) : (
                <View style={[styles.emojiPlaceholder, { backgroundColor: `${portfolio.color}30` }]}>
                  <Text style={[styles.emojiInitial, { color: portfolio.color }]}>
                    {portfolio.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.titleBlock}>
                <Text style={styles.name} numberOfLines={1}>{portfolio.name}</Text>
                {portfolio.description ? (
                  <Text style={styles.description} numberOfLines={1}>{portfolio.description}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.healthBadge, { backgroundColor: `${hc.color}18`, borderColor: `${hc.color}30` }]}>
              <View style={[styles.healthDot, { backgroundColor: hc.color }]} />
              <Text style={[styles.healthScore, { color: hc.color }]}>{score}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: 'Projects', value: portfolio.projectCount },
              { label: 'Tasks', value: portfolio.totalTasks ?? '—' },
              { label: 'Members', value: portfolio.totalMembers ?? '—' },
            ].map(s => (
              <View key={s.label} style={styles.statCell}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Completion</Text>
              <Text style={styles.progressPct}>{completionPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPct}%` as any, backgroundColor: portfolio.color }]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    backgroundColor: '#FFFFFF',
  },
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  androidShadow: { elevation: 3 },
  accentBar: { height: 3 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  emoji: { fontSize: 24, lineHeight: 28 },
  emojiPlaceholder: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emojiInitial: { fontSize: 14, fontWeight: '700' },
  titleBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  description: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  healthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  healthDot: { width: 5, height: 5, borderRadius: 3 },
  healthScore: { fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#F7F8FA',
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  statLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  progressPct: { fontSize: 10, color: '#6B6F7B', fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#F0F0F5', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
