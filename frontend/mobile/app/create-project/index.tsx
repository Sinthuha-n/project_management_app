/**
 * Step 1 — Select Project Type (Agile or Kanban)
 * Mirrors the web /createProject page.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Polyline } from 'react-native-svg';
import { T } from '@/src/constants/tokens';

const { width: W } = Dimensions.get('window');

// ─── Icons ────────────────────────────────────────────────────────────────────

function AgileIcon({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="22 12 18 12 15 21 9 3 6 12 2 12"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function KanbanIcon({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} strokeWidth={2.2} />
      <Line x1={9} y1={3} x2={9} y2={21} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={15} y1={3} x2={15} y2={21} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M5 12l7-7M5 12l7 7"
        stroke={T.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={T.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Animated Card ────────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  description: string;
  features: string[];
  gradientColors: readonly [string, string];
  IconComponent: React.FC<{ color?: string }>;
  onPress: () => void;
  delay?: number;
}

function ProjectTypeCard({
  title,
  description,
  features,
  gradientColors,
  IconComponent,
  onPress,
  delay = 0,
}: CardProps) {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 160,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={styles.card}
      >
        {/* Icon Header */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          <View style={styles.cardIconWrap}>
            <IconComponent color="#fff" />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </LinearGradient>

        {/* Body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardDesc}>{description}</Text>

          <View style={styles.featureList}>
            {features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <CheckIcon />
                </View>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cardFooter}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaBtnText}>Create {title} Project →</Text>
            </LinearGradient>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const CARDS = [
  {
    type: 'AGILE' as const,
    title: 'Agile',
    description: 'Best for teams using Scrum or Sprints. Plan, track, and manage iterative work efficiently.',
    features: [
      'Sprint planning & backlog',
      'Story points & velocity',
      'Burndown charts',
      'Retrospectives',
    ],
    gradientColors: ['#155DFC', '#6366F1'] as const,
    IconComponent: AgileIcon,
  },
  {
    type: 'KANBAN' as const,
    title: 'Kanban',
    description: 'Best for continuous flow. Visualize work, limit WIP, and maximize team efficiency.',
    features: [
      'Visual workflow board',
      'WIP limits & swimlanes',
      'Cycle time analytics',
      'Continuous delivery',
    ],
    gradientColors: ['#7C3AED', '#EC4899'] as const,
    IconComponent: KanbanIcon,
  },
] as const;

export default function SelectProjectTypeScreen() {
  const router = useRouter();

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(headerY, { toValue: 0, tension: 160, friction: 18, useNativeDriver: true }),
    ]).start();
  }, [headerOpacity, headerY]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <BackArrow />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 1 OF 3</Text>
            </View>
            <Text style={styles.headerTitle}>Select Project Type</Text>
            <Text style={styles.headerSub}>
              {"Choose the methodology that best fits your team's workflow."}
            </Text>
          </View>
        </Animated.View>

        {/* Progress Bar */}
        <Animated.View style={[styles.progressWrap, { opacity: headerOpacity }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '33%' }]} />
          </View>
        </Animated.View>

        {/* ── Cards ── */}
        <View style={styles.cards}>
          {CARDS.map((card, i) => (
            <ProjectTypeCard
              key={card.type}
              title={card.title}
              description={card.description}
              features={[...card.features]}
              gradientColors={card.gradientColors}
              IconComponent={card.IconComponent}
              delay={100 + i * 100}
              onPress={() =>
                router.push({
                  pathname: '/create-project/setup',
                  params: { type: card.type },
                })
              }
            />
          ))}
        </View>

        {/* Bottom hint */}
        <Animated.View style={[styles.hint, { opacity: headerOpacity }]}>
          <Text style={styles.hintText}>
            You can always switch methodology later from project settings.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bgSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  /* Header */
  header: { paddingTop: 16, marginBottom: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerCenter: { alignItems: 'center' },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: T.primaryLight,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: T.primary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: T.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: W * 0.7,
  },

  /* Progress */
  progressWrap: { marginBottom: 24 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: T.primary,
  },

  /* Cards */
  cards: { gap: 16 },

  card: {
    borderRadius: 20,
    backgroundColor: T.bg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardBody: { padding: 20 },
  cardDesc: {
    fontSize: 14,
    color: T.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },

  featureList: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: T.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { fontSize: 13, color: T.textPrimary, fontWeight: '500', flex: 1 },

  cardFooter: {},
  ctaBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* Hint */
  hint: { marginTop: 24, alignItems: 'center' },
  hintText: { fontSize: 12, color: T.textMuted, textAlign: 'center' },
});
