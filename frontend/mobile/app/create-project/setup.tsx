/**
 * Step 2 — Project Setup
 * Mirrors the web /createProject/projectSetup page.
 * Receives ?type=AGILE|KANBAN from Step 1.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { T } from '@/src/constants/tokens';
import { useProjectSetup, type ProjectType, type TeamOption } from '@/src/hooks/useCreateProject';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={T.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AgileIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function KanbanIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#fff" strokeWidth={2.2} />
      <Line x1={9} y1={3} x2={9} y2={21} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Line x1={15} y1={3} x2={15} y2={21} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckCircleIcon({ color = T.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M8 12l3 3 5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ErrorCircleIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#EF4444" strokeWidth={2} />
      <Path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Field Components ─────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <View style={fStyles.labelRow}>
      <Text style={fStyles.label}>{label}</Text>
      {required && <Text style={fStyles.required}> *</Text>}
    </View>
  );
}

function ValidationHint({
  checking,
  isValid,
  availableText,
  takenText,
  inlineError,
}: {
  checking: boolean;
  isValid: boolean | null;
  availableText: string;
  takenText: string;
  inlineError?: string | null;
}) {
  if (inlineError) {
    return (
      <View style={fStyles.hintRow}>
        <ErrorCircleIcon />
        <Text style={fStyles.errorHint}>{inlineError}</Text>
      </View>
    );
  }
  if (checking) {
    return (
      <View style={fStyles.hintRow}>
        <ActivityIndicator size={12} color={T.textMuted} />
        <Text style={fStyles.mutedHint}>Checking...</Text>
      </View>
    );
  }
  if (isValid === true) {
    return (
      <View style={fStyles.hintRow}>
        <CheckCircleIcon color="#16A34A" />
        <Text style={fStyles.successHint}>{availableText}</Text>
      </View>
    );
  }
  if (isValid === false) {
    return (
      <View style={fStyles.hintRow}>
        <ErrorCircleIcon />
        <Text style={fStyles.errorHint}>{takenText}</Text>
      </View>
    );
  }
  return null;
}

const fStyles = StyleSheet.create({
  labelRow: { flexDirection: 'row', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: T.textPrimary },
  required: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  mutedHint: { fontSize: 12, color: T.textMuted },
  successHint: { fontSize: 12, color: '#16A34A', fontWeight: '500' },
  errorHint: { fontSize: 12, color: '#EF4444', fontWeight: '500', flex: 1 },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={secStyles.card}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  card: {
    backgroundColor: T.bg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: T.border,
    gap: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  title: { fontSize: 13, fontWeight: '700', color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
});

// ─── Team Toggle ──────────────────────────────────────────────────────────────

function TeamToggle({
  value,
  onChange,
}: {
  value: TeamOption;
  onChange: (v: TeamOption) => void;
}) {
  return (
    <View style={togStyles.wrap}>
      {(['NEW', 'EXISTING'] as TeamOption[]).map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[togStyles.tab, active && togStyles.activeTab]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[togStyles.tabText, active && togStyles.activeText]}>
              {opt === 'NEW' ? 'Create New Team' : 'Use Existing'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const togStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: T.bgSecondary,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: T.border,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: T.bg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  tabText: { fontSize: 13, fontWeight: '500', color: T.textMuted },
  activeText: { color: T.textPrimary, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProjectSetupScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const projectType = (type === 'KANBAN' ? 'KANBAN' : 'AGILE') as ProjectType;

  const {
    projectName, setProjectName,
    projectKey, setProjectKey,
    description, setDescription,
    teamOption, setTeamOption,
    teamName, setTeamName,
    errors,
    serverError,
    projectKeyInlineError,
    isKeyValid, isTeamValid,
    checkingKey, checkingTeam,
    loading,
    submit,
  } = useProjectSetup(projectType);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 160, friction: 18, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContinue = async () => {
    try {
      const { projectId, teamIsNew } = await submit();
      await AsyncStorage.multiSet([
        ['currentProjectId', String(projectId)],
        ['currentProjectKey', projectKey],
        ['currentProjectName', projectName],
      ]);
      if (teamIsNew) {
        router.push({
          pathname: '/create-project/invite',
          params: { projectId: String(projectId), projectKey },
        });
      } else {
        router.replace(`/summary/${projectId}` as never);
      }
    } catch {
      // errors are handled inside the hook
    }
  };

  const gradientColors: readonly [string, string] =
    projectType === 'AGILE' ? ['#155DFC', '#6366F1'] : ['#7C3AED', '#EC4899'];

  const inputStyle = (hasError: boolean, isSuccess?: boolean) => [
    inputStyles.base,
    hasError ? inputStyles.errorBorder : isSuccess ? inputStyles.successBorder : null,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <BackArrow />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 2 OF 3</Text>
              </View>
              <Text style={styles.headerTitle}>Set Up Your Project</Text>
              <Text style={styles.headerSub}>Tell us about your project to get started.</Text>
            </View>
          </Animated.View>

          {/* Progress Bar */}
          <Animated.View style={[styles.progressWrap, { opacity: fadeAnim }]}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: '66%' }]}
              />
            </View>
          </Animated.View>

          {/* ── Methodology Badge ── */}
          <Animated.View style={[styles.methodBadge, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.methodIcon}
            >
              {projectType === 'AGILE' ? <AgileIcon /> : <KanbanIcon />}
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodLabel}>Methodology</Text>
              <Text style={styles.methodName}>{projectType === 'AGILE' ? 'Agile (Scrum)' : 'Kanban'}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Server Error ── */}
          {serverError && (
            <View style={styles.serverError}>
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          )}

          {/* ── Project Details ── */}
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <SectionCard title="Project Details">
              {/* Project Name */}
              <View>
                <FieldLabel label="Project Name" required />
                <TextInput
                  style={inputStyle(!!errors.projectName)}
                  placeholder="e.g. Mobile App Redesign"
                  placeholderTextColor={T.textMuted}
                  value={projectName}
                  onChangeText={setProjectName}
                  returnKeyType="next"
                  autoCapitalize="words"
                />
                {errors.projectName && (
                  <View style={fStyles.hintRow}>
                    <ErrorCircleIcon />
                    <Text style={fStyles.errorHint}>Project name is required</Text>
                  </View>
                )}
              </View>

              {/* Project Key */}
              <View>
                <FieldLabel label="Project Key" required />
                <TextInput
                  style={inputStyle(
                    !!errors.projectKey || isKeyValid === false,
                    isKeyValid === true,
                  )}
                  placeholder="e.g. MOBILE-APP"
                  placeholderTextColor={T.textMuted}
                  value={projectKey}
                  onChangeText={setProjectKey}
                  autoCapitalize="characters"
                  maxLength={10}
                  returnKeyType="next"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={fStyles.mutedHint}>Short unique identifier (max 10 chars)</Text>
                  <ValidationHint
                    checking={checkingKey}
                    isValid={isKeyValid}
                    availableText="Available"
                    takenText="Already in use"
                    inlineError={projectKeyInlineError}
                  />
                </View>
              </View>

              {/* Description */}
              <View>
                <FieldLabel label="Description" />
                <TextInput
                  style={[inputStyle(false), inputStyles.textarea]}
                  placeholder="Describe your project and its goals..."
                  placeholderTextColor={T.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </SectionCard>
          </Animated.View>

          {/* ── Team Setup ── */}
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <SectionCard title="Team Setup">
              <TeamToggle value={teamOption} onChange={setTeamOption} />

              <View>
                <FieldLabel label="Team Name" required />
                <TextInput
                  style={inputStyle(
                    !!errors.teamName || isTeamValid === false,
                    isTeamValid === true,
                  )}
                  placeholder={teamOption === 'NEW' ? 'Enter new team name' : 'Enter existing team name'}
                  placeholderTextColor={T.textMuted}
                  value={teamName}
                  onChangeText={setTeamName}
                  autoCapitalize="none"
                  returnKeyType="done"
                />
                <ValidationHint
                  checking={checkingTeam}
                  isValid={isTeamValid}
                  availableText={teamOption === 'NEW' ? 'Name is available' : 'Team found — you\'re a member'}
                  takenText={teamOption === 'NEW' ? 'Team already exists' : 'Not found or not a member'}
                />
                {errors.teamName && !isTeamValid && !checkingTeam && (
                  <View style={fStyles.hintRow}>
                    <ErrorCircleIcon />
                    <Text style={fStyles.errorHint}>Team name is required</Text>
                  </View>
                )}
              </View>

              {/* Info note */}
              <View style={styles.infoNote}>
                <Text style={styles.infoNoteText}>
                  {teamOption === 'NEW'
                    ? '✨ A new team will be created. You\'ll invite members in the next step.'
                    : '🔗 You\'ll join an existing team and proceed to the project summary.'}
                </Text>
              </View>
            </SectionCard>
          </Animated.View>

          {/* ── Actions ── */}
          <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.backBtnBottom} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backBtnBottomText}>← Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.continueBtn, (loading || isKeyValid === false || isTeamValid === false) && styles.continueBtnDisabled]}
              onPress={handleContinue}
              disabled={loading || isKeyValid === false || isTeamValid === false}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading || isKeyValid === false || isTeamValid === false
                  ? ['#9CA3AF', '#9CA3AF']
                  : gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueBtnGradient}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.continueBtnText}>Continue →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
    paddingHorizontal: 14,
    fontSize: 15,
    color: T.textPrimary,
  },
  textarea: {
    height: 84,
    paddingTop: 12,
    paddingBottom: 12,
  },
  errorBorder: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  successBorder: { borderColor: '#16A34A' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bgSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },

  header: { paddingTop: 16 },
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
  stepBadgeText: { fontSize: 10, fontWeight: '700', color: T.primary, letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },

  progressWrap: {},
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: T.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { fontSize: 11, fontWeight: '600', color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  methodName: { fontSize: 16, fontWeight: '700', color: T.textPrimary },
  changeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: T.primaryLight,
  },
  changeBtnText: { fontSize: 13, fontWeight: '700', color: T.primary },

  serverError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
  },
  serverErrorText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },

  infoNote: {
    backgroundColor: T.primaryLight,
    borderRadius: 12,
    padding: 12,
  },
  infoNoteText: { fontSize: 13, color: T.primary, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  backBtnBottom: {
    width: 90,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnBottomText: { fontSize: 14, fontWeight: '600', color: T.textSecondary },
  continueBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
