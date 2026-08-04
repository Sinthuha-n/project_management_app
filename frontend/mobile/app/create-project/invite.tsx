/**
 * Step 3 — Invite Members
 * Mirrors the web /createProject/inviteMembers page.
 * Receives ?projectId=...&projectKey=... from Step 2.
 */
import React, { useRef, useEffect, useState } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { T } from '@/src/constants/tokens';
import { useInviteMembers, type InviteRole } from '@/src/hooks/useCreateProject';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={T.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EmailIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="22,6 12,13 2,6" stroke={T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDown({ color = T.textMuted }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ color = T.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PeopleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={7} r={4} stroke="#fff" strokeWidth={2} />
      <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Role Selector ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<InviteRole, { label: string; color: string; desc: string }> = {
  ADMIN:  { label: 'Admin',  color: T.primary,   desc: 'Full access to project settings & team' },
  MEMBER: { label: 'Member', color: '#16A34A',   desc: 'Create, edit, manage tasks & sprints'   },
  VIEWER: { label: 'Viewer', color: '#F59E0B',   desc: 'Read-only view of project progress'     },
};

function RoleSelector({
  value,
  onChange,
}: {
  value: InviteRole;
  onChange: (r: InviteRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = ROLE_CONFIG[value];

  return (
    <>
      <TouchableOpacity
        style={roleStyles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={[roleStyles.dot, { backgroundColor: cfg.color }]} />
        <Text style={roleStyles.triggerText}>{cfg.label}</Text>
        <ChevronDown />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={roleStyles.overlay} onPress={() => setOpen(false)}>
          <View style={roleStyles.sheet}>
            <Text style={roleStyles.sheetTitle}>Select Role</Text>
            {(Object.keys(ROLE_CONFIG) as InviteRole[]).map((r) => {
              const rcfg = ROLE_CONFIG[r];
              const selected = value === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[roleStyles.option, selected && { backgroundColor: rcfg.color + '15' }]}
                  onPress={() => { onChange(r); setOpen(false); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[roleStyles.dot, { backgroundColor: rcfg.color }]} />
                      <Text style={[roleStyles.optionLabel, selected && { color: rcfg.color }]}>
                        {rcfg.label}
                      </Text>
                    </View>
                    <Text style={roleStyles.optionDesc}>{rcfg.desc}</Text>
                  </View>
                  {selected && <CheckIcon color={rcfg.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const roleStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
    minWidth: 120,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  triggerText: { fontSize: 14, fontWeight: '600', color: T.textPrimary, flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: T.textPrimary, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', color: T.textPrimary },
  optionDesc: { fontSize: 12, color: T.textMuted, marginTop: 2 },
});

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({ type, text }: { type: 'success' | 'error'; text: string }) {
  const isSuccess = type === 'success';
  return (
    <View style={[bannerStyles.wrap, isSuccess ? bannerStyles.success : bannerStyles.error]}>
      <Text style={[bannerStyles.text, isSuccess ? bannerStyles.successText : bannerStyles.errorText]}>
        {isSuccess ? '✓ ' : '⚠ '}{text}
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: { borderRadius: 12, padding: 12, borderWidth: 1 },
  success: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  error:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  text: { fontSize: 14, fontWeight: '500' },
  successText: { color: '#15803D' },
  errorText:   { color: '#DC2626' },
});

// ─── Permissions Info Card ────────────────────────────────────────────────────

function PermissionsCard() {
  return (
    <View style={permStyles.card}>
      <Text style={permStyles.title}>Role Permissions</Text>
      {(Object.keys(ROLE_CONFIG) as InviteRole[]).map((r) => {
        const cfg = ROLE_CONFIG[r];
        return (
          <View key={r} style={permStyles.row}>
            <View style={[permStyles.dot, { backgroundColor: cfg.color }]} />
            <Text style={permStyles.roleLabel}>{cfg.label}: </Text>
            <Text style={permStyles.roleDesc}>{cfg.desc}</Text>
          </View>
        );
      })}
    </View>
  );
}

const permStyles = StyleSheet.create({
  card: {
    backgroundColor: T.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  title: { fontSize: 13, fontWeight: '700', color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  roleLabel: { fontSize: 13, fontWeight: '700', color: T.textPrimary },
  roleDesc: { fontSize: 13, color: T.textSecondary, flex: 1, lineHeight: 18 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InviteMembersScreen() {
  const router = useRouter();
  const { projectId: pidParam, projectKey: pkParam } = useLocalSearchParams<{
    projectId: string;
    projectKey: string;
  }>();

  const projectId = pidParam ? Number(pidParam) : null;
  const projectKey = pkParam ?? null;

  const {
    email, setEmail,
    role, setRole,
    loading,
    canInvite,
    statusType, statusText,
    sendInvite,
  } = useInviteMembers(projectId);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 160, friction: 18, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const goToProject = () => {
    if (projectId) {
      router.replace(`/summary/${projectId}` as never);
    } else {
      router.replace('/(tabs)' as never);
    }
  };

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
                <Text style={styles.stepBadgeText}>STEP 3 OF 3</Text>
              </View>
              <Text style={styles.headerTitle}>Invite Your Team</Text>
              <Text style={styles.headerSub}>
                Collaborate better by adding team members to your project.
              </Text>
              {projectKey && (
                <View style={styles.keyBadge}>
                  <Text style={styles.keyBadgeText}>
                    Project: <Text style={styles.keyBadgeKey}>{projectKey}</Text>
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Progress Bar */}
          <Animated.View style={[styles.progressWrap, { opacity: fadeAnim }]}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#155DFC', '#9810FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: '100%' }]}
              />
            </View>
          </Animated.View>

          {/* ── Status Banner ── */}
          {statusType && <StatusBanner type={statusType} text={statusText} />}

          {/* ── Invite Card ── */}
          <Animated.View style={[styles.inviteCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sectionLabel}>SEND INVITATION</Text>

            {/* Email Input */}
            <View>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.emailWrap}>
                <View style={styles.emailIcon}>
                  <EmailIcon />
                </View>
                <TextInput
                  style={styles.emailInput}
                  placeholder="teammate@example.com"
                  placeholderTextColor={T.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={canInvite ? sendInvite : undefined}
                />
              </View>
            </View>

            {/* Role Selector */}
            <View>
              <Text style={styles.fieldLabel}>Role</Text>
              <RoleSelector value={role} onChange={setRole} />
            </View>

            {/* Send Invite Button */}
            <TouchableOpacity
              onPress={sendInvite}
              disabled={!canInvite || loading}
              activeOpacity={0.85}
              style={styles.sendBtnWrap}
            >
              <LinearGradient
                colors={!canInvite || loading ? ['#9CA3AF', '#9CA3AF'] : ['#155DFC', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendBtn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PeopleIcon />
                      <Text style={styles.sendBtnText}>Send Invitation</Text>
                    </View>
                  )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Permissions Info ── */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <PermissionsCard />
          </Animated.View>

          {/* ── Skip Info ── */}
          <Animated.View style={[styles.skipCard, { opacity: fadeAnim }]}>
            <View style={styles.skipIconWrap}>
              <LinearGradient
                colors={['#155DFC', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.skipIconGradient}
              >
                <PeopleIcon />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.skipTitle}>You can invite later</Text>
              <Text style={styles.skipDesc}>
                Skip this step and add team members from your project settings anytime.
              </Text>
            </View>
          </Animated.View>

          {/* ── Bottom Actions ── */}
          <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.skipBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>← Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.startBtn}
              onPress={goToProject}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#155DFC', '#9810FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Text style={styles.startBtnText}>Start Project 🚀</Text>
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
  stepBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: T.primaryLight, marginBottom: 10 },
  stepBadgeText: { fontSize: 10, fontWeight: '700', color: T.primary, letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: T.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20, maxWidth: 280 },
  keyBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  keyBadgeText: { fontSize: 12, color: T.textSecondary },
  keyBadgeKey: { fontWeight: '700', color: T.primary },

  progressWrap: {},
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: T.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  inviteCard: {
    backgroundColor: T.bg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: T.border,
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: T.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: T.textPrimary, marginBottom: 8 },

  emailWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
    paddingHorizontal: 14,
    gap: 10,
  },
  emailIcon: { justifyContent: 'center' },
  emailInput: { flex: 1, fontSize: 15, color: T.textPrimary },

  sendBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  sendBtn: { height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: T.primaryLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.primary + '30',
  },
  skipIconWrap: {},
  skipIconGradient: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  skipTitle: { fontSize: 14, fontWeight: '700', color: T.textPrimary, marginBottom: 4 },
  skipDesc: { fontSize: 13, color: T.textSecondary, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 12 },
  skipBtn: {
    width: 90,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: { fontSize: 14, fontWeight: '600', color: T.textSecondary },
  startBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  startBtnGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
