import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Animated, ActivityIndicator,
  Modal, KeyboardAvoidingView, TouchableWithoutFeedback,
  Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Circle, Polygon, Line } from 'react-native-svg';
import { T } from '../../../src/constants/tokens';
import { projectService, type ProjectDetails } from '../../../src/services/project-service';
import { getCurrentUserId } from '../../../src/auth/storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import CustomFieldsManager from '../../../src/components/settings/CustomFieldsManager';
import RecurringSchedulesManager from '../../../src/components/settings/RecurringSchedulesManager';
import NotificationPreferencesPanel from '../../../src/components/settings/NotificationPreferencesPanel';

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const ChevronLeft = ({ color = T.textPrimary, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const FileIcon = ({ color = T.textSecondary }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <Path d="M14 2v6h6" />
    <Line x1={16} y1={13} x2={8} y2={13} />
    <Line x1={16} y1={17} x2={8} y2={17} />
    <Line x1={10} y1={9} x2={8} y2={9} />
  </Svg>
);

const InfoIcon = ({ color = T.textSecondary }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} />
    <Line x1={12} y1={16} x2={12} y2={12} />
    <Line x1={12} y1={8} x2={12.01} y2={8} />
  </Svg>
);

const ShieldIcon = ({ color = '#EF4444' }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
);

const TrashIcon = ({ color = '#EF4444', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="3 6 5 6 21 6" />
    <Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <Path d="M10 11v6" />
    <Path d="M14 11v6" />
    <Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </Svg>
);

const LeaveIcon = ({ color = '#F97316', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <Polygon points="16 17 21 12 16 7" />
    <Line x1={21} y1={12} x2={9} y2={12} />
  </Svg>
);

const AlertIcon = ({ color = '#F59E0B', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <Line x1={12} y1={9} x2={12} y2={13} />
    <Line x1={12} y1={17} x2={12.01} y2={17} />
  </Svg>
);

const CheckIcon = ({ color = '#22C55E', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const XIcon = ({ color = T.textSecondary, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Line x1={18} y1={6} x2={6} y2={18} />
    <Line x1={6} y1={6} x2={18} y2={18} />
  </Svg>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  icon,
  iconBg,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.cardIconWrap, { backgroundColor: iconBg ?? T.bgSecondary }]}>
          {icon}
        </View>
        <View style={s.cardHeaderText}>
          <Text style={s.cardTitle}>{title}</Text>
          {subtitle ? <Text style={s.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={s.cardDivider} />
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

// ─── Read-only identity row ───────────────────────────────────────────────────

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.identityRow}>
      <Text style={s.identityLabel}>{label}</Text>
      <View style={s.identityValue}>
        <Text style={s.identityValueText} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Leave confirmation modal ─────────────────────────────────────────────────

function LeaveModal({
  visible,
  projectName,
  onClose,
  onConfirm,
  isLeaving,
}: {
  visible: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLeaving: boolean;
}) {
  const insets = useSafeAreaInsets();

  const EFFECTS = [
    'You will be removed from the project team',
    'Your task assignments will be unassigned',
    'You will no longer receive project notifications',
    'An admin can re-invite you later if needed',
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <TouchableWithoutFeedback onPress={!isLeaving ? onClose : undefined}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[m.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={m.handle} />

          <View style={m.sheetHeader}>
            <View style={[m.alertIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <LeaveIcon color="#F97316" size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.sheetTitle}>Leave Project</Text>
              <Text style={m.sheetSubtitle}>
                You will lose access to <Text style={{ fontWeight: '700', color: T.textPrimary }}>{projectName}</Text> immediately
              </Text>
            </View>
            {!isLeaving && (
              <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
                <XIcon color={T.textMuted} size={16} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[m.consequenceBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Text style={[m.consequenceTitle, { color: '#9A3412' }]}>WHAT HAPPENS WHEN YOU LEAVE</Text>
            {EFFECTS.map((e) => (
              <View key={e} style={m.consequenceRow}>
                <View style={[m.consequenceDot, { backgroundColor: '#F97316' }]} />
                <Text style={[m.consequenceText, { color: '#9A3412' }]}>{e}</Text>
              </View>
            ))}
          </View>

          <View style={m.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isLeaving}
              style={[m.btn, m.btnCancel]}
              activeOpacity={0.75}
            >
              <Text style={m.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isLeaving}
              style={[m.btn, { backgroundColor: '#F97316', flex: 1 }, isLeaving && m.btnDisabled]}
              activeOpacity={0.8}
            >
              {isLeaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <LeaveIcon color="#fff" size={15} />
              )}
              <Text style={m.btnDeleteText}>{isLeaving ? 'Leaving…' : 'Leave Project'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({
  visible,
  projectName,
  onClose,
  onConfirm,
  isDeleting,
}: {
  visible: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const insets = useSafeAreaInsets();
  const canDelete = confirmText === projectName;

  useEffect(() => {
    if (!visible) setConfirmText('');
  }, [visible]);

  const CONSEQUENCES = [
    'All tasks, subtasks and attachments',
    'All sprint data, boards and history',
    'All team member associations',
    'All custom fields and configurations',
    'All milestones and project documents',
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={!isDeleting ? Keyboard.dismiss : undefined}>
          <View style={m.overlay}>
            <TouchableWithoutFeedback onPress={!isDeleting ? onClose : undefined}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View style={[m.sheet, { paddingBottom: insets.bottom + 8 }]}>
              {/* Handle */}
              <View style={m.handle} />

              {/* Header */}
              <View style={m.sheetHeader}>
                <View style={m.alertIconWrap}>
                  <AlertIcon color="#EF4444" size={26} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.sheetTitle}>Delete Project</Text>
                  <Text style={m.sheetSubtitle}>This action is permanent and cannot be undone</Text>
                </View>
                {!isDeleting && (
                  <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
                    <XIcon color={T.textMuted} size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Consequences */}
              <View style={m.consequenceBox}>
                <Text style={m.consequenceTitle}>EVERYTHING THAT WILL BE DELETED</Text>
                {CONSEQUENCES.map((c) => (
                  <View key={c} style={m.consequenceRow}>
                    <View style={m.consequenceDot} />
                    <Text style={m.consequenceText}>{c}</Text>
                  </View>
                ))}
              </View>

              {/* Confirm input */}
              <View style={m.confirmSection}>
                <Text style={m.confirmLabel}>
                  Type{' '}
                  <Text style={m.confirmProjectName}>{projectName}</Text>
                  {' '}to confirm:
                </Text>
                <TextInput
                  style={[
                    m.confirmInput,
                    confirmText.length > 0 && !canDelete && m.confirmInputError,
                    canDelete && m.confirmInputOk,
                  ]}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder={projectName}
                  placeholderTextColor={T.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  editable={!isDeleting}
                  returnKeyType="done"
                  onSubmitEditing={() => canDelete && !isDeleting && onConfirm()}
                />
                {confirmText.length > 0 && !canDelete && (
                  <Text style={m.confirmMismatch}>Project name does not match</Text>
                )}
              </View>

              {/* Actions */}
              <View style={m.actions}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isDeleting}
                  style={[m.btn, m.btnCancel]}
                  activeOpacity={0.75}
                >
                  <Text style={m.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onConfirm}
                  disabled={!canDelete || isDeleting}
                  style={[m.btn, m.btnDelete, (!canDelete || isDeleting) && m.btnDisabled]}
                  activeOpacity={0.8}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <TrashIcon color="#fff" size={15} />
                  )}
                  <Text style={m.btnDeleteText}>{isDeleting ? 'Deleting…' : 'Delete Project'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function ProjectSettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projectId, projectName: routeProjectName } = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();
  const numericId = Number(projectId);

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // General form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAnim] = useState(() => new Animated.Value(0));

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Leave
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const isDirtyGeneral =
    project !== null &&
    (name.trim() !== project.name || (description.trim() !== (project.description ?? '')));

  const load = useCallback(async () => {
    if (isNaN(numericId)) return;
    setLoading(true);
    try {
      const data = await projectService.get(numericId);
      setProject(data);
      setName(data.name);
      setDescription(data.description ?? '');
    } catch {
      // silently fall back to route param name if fetch fails
      if (routeProjectName) setName(Array.isArray(routeProjectName) ? routeProjectName[0] : routeProjectName);
    } finally {
      setLoading(false);
    }
  }, [numericId, routeProjectName]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId).catch(() => {});
  }, []);

  const flashSaved = () => {
    Animated.sequence([
      Animated.timing(savedAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(savedAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleSaveGeneral = async () => {
    if (!project || !isDirtyGeneral) return;
    Keyboard.dismiss();
    setIsSaving(true);
    try {
      const updated = await projectService.update(numericId, {
        name: name.trim(),
        description: description.trim(),
      });
      setProject(updated);
      setName(updated.name);
      setDescription(updated.description ?? '');
      flashSaved();
    } catch {
      // keep dirty state so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project?.teamId) return;
    setIsDeleting(true);
    try {
      await projectService.remove(numericId, project.teamId);
      setShowDeleteModal(false);
      router.dismissAll();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete project. Please try again.';
      setIsDeleting(false);
      Alert.alert('Delete Failed', msg);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await projectService.leave(numericId);
      setShowLeaveModal(false);
      router.dismissAll();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to leave project. Please try again.';
      setIsLeaving(false);
      Alert.alert('Leave Failed', msg);
    }
  };

  const isOwner = project !== null && currentUserId !== null && project.ownerId === currentUserId;

  const displayName = project?.name ?? (Array.isArray(routeProjectName) ? routeProjectName[0] : routeProjectName) ?? 'Project';

  const savedOpacity = savedAnim;

  if (isNaN(numericId)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgSecondary }}>
        <Text style={{ color: '#EF4444', fontSize: 14 }}>Invalid project ID</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bgSecondary }}>
      <StatusBar style="dark" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft color={T.textPrimary} size={22} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Project Settings</Text>
          {displayName ? <Text style={s.headerSub} numberOfLines={1}>{displayName}</Text> : null}
        </View>

        {/* Right spacer for balance */}
        <View style={s.backBtn} />
      </View>

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={s.loadingText}>Loading settings…</Text>
        </View>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {!loading && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── General ─────────────────────────────────────────────── */}
            <SectionCard
              title="General"
              subtitle="Edit project name and description"
              icon={<FileIcon color={T.primary} />}
              iconBg={T.primaryLight}
            >
              <View style={s.fieldGroup}>
                <Text style={s.label}>PROJECT NAME</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter project name"
                  placeholderTextColor={T.textMuted}
                  returnKeyType="next"
                  autoCorrect={false}
                />
              </View>

              <View style={[s.fieldGroup, { marginTop: 16 }]}>
                <Text style={s.label}>DESCRIPTION</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a description…"
                  placeholderTextColor={T.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={s.saveRow}>
                <Animated.View style={{ opacity: savedOpacity, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CheckIcon color="#22C55E" size={14} />
                  <Text style={s.savedText}>Changes saved</Text>
                </Animated.View>

                <TouchableOpacity
                  onPress={handleSaveGeneral}
                  disabled={!isDirtyGeneral || isSaving}
                  style={[s.saveBtn, (!isDirtyGeneral || isSaving) && s.saveBtnDisabled]}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : null}
                  <Text style={s.saveBtnText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>

            {/* ── Project Identity ─────────────────────────────────────── */}
            {project && (project.projectKey || project.createdAt || project.teamName || project.ownerName) && (
              <SectionCard
                title="Project Identity"
                subtitle="Read-only project metadata"
                icon={<InfoIcon color="#8B5CF6" />}
                iconBg="#F5F3FF"
              >
                {project.projectKey ? (
                  <IdentityRow label="Project Key" value={project.projectKey} />
                ) : null}
                {project.createdAt ? (
                  <IdentityRow
                    label="Created"
                    value={new Date(project.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  />
                ) : null}
                {project.teamName ? <IdentityRow label="Team" value={project.teamName} /> : null}
                {project.ownerName ? <IdentityRow label="Owner" value={project.ownerName} /> : null}
              </SectionCard>
            )}

            {/* ── Custom Fields ────────────────────────────────────────── */}
            <SectionCard
              title="Custom Fields"
              subtitle="Add extra fields to all tasks in this project"
              icon={<MaterialCommunityIcons name="form-select" size={18} color="#0891B2" />}
              iconBg="#ECFEFF"
            >
              <CustomFieldsManager projectId={numericId} />
            </SectionCard>

            {/* ── Recurring Tasks ──────────────────────────────────────── */}
            <SectionCard
              title="Recurring Tasks"
              subtitle="Manage automated recurring schedules"
              icon={<MaterialCommunityIcons name="autorenew" size={18} color="#D97706" />}
              iconBg="#FFF6E8"
            >
              <RecurringSchedulesManager projectId={numericId} />
            </SectionCard>

            {/* ── Notification Preferences ─────────────────────────────── */}
            <SectionCard
              title="Notification Overrides"
              subtitle="Fine-tune which project events notify you"
              icon={<MaterialCommunityIcons name="bell-cog-outline" size={18} color="#155DFC" />}
              iconBg={T.primaryLight}
            >
              <NotificationPreferencesPanel
                projectId={numericId}
                helperText="These overrides only affect this project. If no override exists, your global notification defaults still apply."
              />
            </SectionCard>

            {/* ── Danger Zone ──────────────────────────────────────────── */}
            <View style={s.dangerCard}>
              <View style={s.dangerHeader}>
                <View style={s.dangerIconWrap}>
                  <ShieldIcon color="#EF4444" />
                </View>
                <View>
                  <Text style={s.dangerTitle}>Danger Zone</Text>
                  <Text style={s.dangerSubtitle}>Irreversible actions — proceed with caution</Text>
                </View>
              </View>

              <View style={s.dangerDivider} />

              {/* Leave — visible to non-owners only */}
              {!isOwner && (
                <View style={s.dangerRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={s.dangerRowTitle}>Leave this project</Text>
                    <Text style={s.dangerRowDesc}>
                      Remove yourself from the project team. Your task assignments will be cleared.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowLeaveModal(true)}
                    style={[s.deleteBtn, { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}
                    activeOpacity={0.8}
                  >
                    <LeaveIcon color="#F97316" size={14} />
                    <Text style={[s.deleteBtnText, { color: '#F97316' }]}>Leave</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delete — visible to owners only */}
              {isOwner && (
                <View style={s.dangerRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={s.dangerRowTitle}>Delete this project</Text>
                    <Text style={s.dangerRowDesc}>
                      Permanently remove this project and all associated data. This cannot be reversed.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowDeleteModal(true)}
                    style={s.deleteBtn}
                    activeOpacity={0.8}
                  >
                    <TrashIcon color="#EF4444" size={14} />
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <LeaveModal
        visible={showLeaveModal}
        projectName={project?.name ?? displayName}
        onClose={() => !isLeaving && setShowLeaveModal(false)}
        onConfirm={handleLeave}
        isLeaving={isLeaving}
      />
      <DeleteModal
        visible={showDeleteModal}
        projectName={project?.name ?? displayName}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: {
    backgroundColor: T.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: T.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: T.textMuted,
    marginTop: 1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: T.textMuted,
    fontWeight: '500',
  },

  // Scroll
  scroll: {
    padding: 16,
    gap: 14,
  },

  // Section card
  card: {
    backgroundColor: T.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: T.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: T.textMuted,
    marginTop: 1,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.borderLight,
    marginHorizontal: 18,
  },
  cardBody: {
    padding: 18,
  },

  // General form
  fieldGroup: {},
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: T.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: T.bgSecondary,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    fontSize: 15,
    fontWeight: '500',
    color: T.textPrimary,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 13,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.borderLight,
  },
  savedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },

  // Identity rows
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.borderLight,
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.textMuted,
    letterSpacing: 0.4,
    width: 90,
    textTransform: 'uppercase',
  },
  identityValue: {
    flex: 1,
    backgroundColor: T.bgSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  identityValueText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: T.textPrimary,
  },

  // Danger zone
  dangerCard: {
    backgroundColor: T.bg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFE4E6',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14 },
      android: { elevation: 2 },
    }),
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFF5F5',
  },
  dangerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    letterSpacing: -0.2,
  },
  dangerSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#EF4444',
    marginTop: 1,
  },
  dangerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FFE4E6',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  dangerRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: T.textPrimary,
    letterSpacing: -0.2,
  },
  dangerRowDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: T.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFE4E6',
    backgroundColor: '#FFF5F5',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  alertIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: T.textPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: T.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: T.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  consequenceBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 8,
  },
  consequenceTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consequenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginTop: 5,
    flexShrink: 0,
  },
  consequenceText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#991B1B',
    lineHeight: 18,
    flex: 1,
  },
  confirmSection: {
    marginBottom: 18,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  confirmProjectName: {
    fontWeight: '800',
    color: T.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  confirmInput: {
    backgroundColor: T.bgSecondary,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    fontWeight: '600',
    color: T.textPrimary,
  },
  confirmInputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  confirmInputOk: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  confirmMismatch: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: T.textPrimary,
  },
  btnDelete: {
    flex: 1.4,
    backgroundColor: '#EF4444',
    ...Platform.select({
      ios: { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  btnDisabled: { opacity: 0.4 },
  btnDeleteText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.1,
  },
});
