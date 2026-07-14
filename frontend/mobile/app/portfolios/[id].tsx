import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePortfolio } from '../../src/hooks/usePortfolios';
import type { PortfolioProject } from '../../src/services/portfolio-service';

// ── FadeSlideIn ──────────────────────────────────────────────────────────────
function FadeSlideIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 180, friction: 20 }),
    ]).start();
  }, [delay, opacity, translateY]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.metricIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ── Project row ──────────────────────────────────────────────────────────────
function ProjectRow({ project, color }: { project: PortfolioProject; color: string }) {
  const isAgile = project.type === 'AGILE';
  return (
    <View style={styles.projectRow}>
      <View style={[styles.projectAvatar, { backgroundColor: `${color}30`, borderColor: `${color}40` }]}>
        <Text style={[styles.projectAvatarText, { color }]}>{project.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.projectInfo}>
        <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.projectMeta}>{project.projectKey} · {project.teamName}</Text>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: isAgile ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)' }]}>
        <Text style={[styles.typeBadgeText, { color: isAgile ? '#818CF8' : '#34D399' }]}>
          {isAgile ? 'Sprint' : 'Kanban'}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function PortfolioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { portfolio, loading, error } = usePortfolio(Number(id));

  const score = portfolio?.healthScore ?? 100;
  const healthColor = score >= 75 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  const healthLabel = score >= 75 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical';
  const completionPct = portfolio?.totalTasks
    ? Math.round(((portfolio.completedTasks ?? 0) / portfolio.totalTasks) * 100)
    : 0;

  if (loading) return (
    <LinearGradient colors={['#020617', '#0f172a', '#1e1b4b', '#020617']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <View style={styles.loadingState}>
        <ActivityIndicator color="#155DFC" size="large" />
      </View>
    </LinearGradient>
  );

  if (error || !portfolio) return (
    <LinearGradient colors={['#020617', '#0f172a', '#1e1b4b', '#020617']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.loadingState}>
          <Text style={styles.errorText}>{error || 'Portfolio not found'}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient
      colors={['#020617', '#0f172a', '#1e1b4b', '#020617']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Back */}
          <FadeSlideIn delay={0}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Portfolios</Text>
            </TouchableOpacity>
          </FadeSlideIn>

          {/* Hero card */}
          <FadeSlideIn delay={60}>
            <View style={styles.heroCard}>
              <View style={[styles.heroBar, { backgroundColor: portfolio.color }]} />
              <View style={styles.heroContent}>
                <View style={styles.heroTop}>
                  <View style={styles.heroLeft}>
                    {portfolio.emoji ? (
                      <Text style={styles.heroEmoji}>{portfolio.emoji}</Text>
                    ) : null}
                    <View style={styles.heroTitle}>
                      <Text style={styles.heroName}>{portfolio.name}</Text>
                      {portfolio.description ? (
                        <Text style={styles.heroDesc} numberOfLines={2}>{portfolio.description}</Text>
                      ) : null}
                      <Text style={styles.heroOwner}>by {portfolio.ownerName}</Text>
                    </View>
                  </View>
                  <View style={[styles.healthBadge, { backgroundColor: `${healthColor}18`, borderColor: `${healthColor}30` }]}>
                    <View style={[styles.healthDot, { backgroundColor: healthColor }]} />
                    <Text style={[styles.healthLabel, { color: healthColor }]}>{healthLabel}</Text>
                  </View>
                </View>

                {/* Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Overall completion</Text>
                    <Text style={[styles.progressPct, { color: healthColor }]}>{completionPct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${completionPct}%` as any, backgroundColor: portfolio.color }]} />
                  </View>
                </View>
              </View>
            </View>
          </FadeSlideIn>

          {/* Metrics grid */}
          <FadeSlideIn delay={120}>
            <Text style={styles.sectionTitle}>METRICS</Text>
            <View style={styles.metricsGrid}>
              <MetricCard label="Projects"  value={portfolio.projectCount}     color="#60A5FA" icon="▣" />
              <MetricCard label="Tasks"     value={portfolio.totalTasks ?? 0}  color="#A78BFA" icon="◈" />
              <MetricCard label="Done"      value={portfolio.completedTasks ?? 0} color="#34D399" icon="✓" />
              <MetricCard label="Overdue"   value={portfolio.overdueTasks ?? 0} color="#F87171" icon="!" />
              <MetricCard label="Members"   value={portfolio.totalMembers ?? 0} color="#FBBF24" icon="⊕" />
              <MetricCard label="Health"    value={`${score}%`}                color="#F472B6" icon="♥" />
            </View>
          </FadeSlideIn>

          {/* Projects list */}
          <FadeSlideIn delay={180}>
            <Text style={styles.sectionTitle}>PROJECTS ({portfolio.projectCount})</Text>
            <View style={styles.projectsCard}>
              {portfolio.projects && portfolio.projects.length > 0 ? (
                portfolio.projects.map((proj, i) => (
                  <React.Fragment key={proj.id}>
                    <ProjectRow project={proj} color={portfolio.color} />
                    {i < portfolio.projects!.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))
              ) : (
                <View style={styles.emptyProjects}>
                  <Text style={styles.emptyProjectsText}>No projects in this portfolio</Text>
                </View>
              )}
            </View>
          </FadeSlideIn>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  backBtn: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },
  // Hero
  heroCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  heroBar: { height: 3 },
  heroContent: { padding: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
  heroLeft: { flexDirection: 'row', gap: 10, flex: 1, minWidth: 0 },
  heroEmoji: { fontSize: 28, lineHeight: 34 },
  heroTitle: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  heroDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 18 },
  heroOwner: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, flexShrink: 0 },
  healthDot: { width: 6, height: 6, borderRadius: 3 },
  healthLabel: { fontSize: 11, fontWeight: '700' },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  progressPct: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  // Sections
  sectionTitle: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 10, marginLeft: 2 },
  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  metricCard: {
    width: '31%', paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start', gap: 6,
  },
  metricIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricIconText: { fontSize: 13, fontWeight: '700' },
  metricValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 24 },
  metricLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  // Projects
  projectsCard: {
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginBottom: 20,
  },
  projectRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  projectAvatar: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  projectAvatarText: { fontSize: 13, fontWeight: '800' },
  projectInfo: { flex: 1, minWidth: 0 },
  projectName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', lineHeight: 18 },
  projectMeta: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 12 },
  emptyProjects: { padding: 24, alignItems: 'center' },
  emptyProjectsText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  bottomPad: { height: 100 },
});
