import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../constants/tokens';
import { projectService } from '../../services/project-service';
import { sprintService, taskService } from '../../services/task-service';
import { taskDetailService, TaskDetailBundle } from '../../services/task-detail-service';
import { apiErrorMessage } from '../../utils/apiError';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type Option = { id: number; label: string };

export interface MobileTaskDetailSheetProps {
  visible: boolean;
  taskId: number | null;
  projectId: number;
  onClose: () => void;
  onChanged?: () => void;
}

function formatDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function memberLabel(member: any) {
  return member.name || member.user?.fullName || member.user?.username || member.user?.email || `Member ${member.userId ?? member.id}`;
}

function memberUserId(member: any) {
  return member.user?.userId ?? member.userId ?? member.id;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MobileTaskDetailSheet({
  visible,
  taskId,
  projectId,
  onClose,
  onChanged,
}: MobileTaskDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TaskDetailBundle | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<Option[]>([]);
  const [milestones, setMilestones] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [storyPoint, setStoryPoint] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [sprintId, setSprintId] = useState<number | null>(null);
  const [milestoneId, setMilestoneId] = useState<number | null>(null);

  const task = bundle?.task;

  const load = useCallback(async () => {
    if (!taskId || !visible) return;
    setLoading(true);
    try {
      const [detail, projectMembers, projectSprints, projectMilestones] = await Promise.all([
        taskDetailService.getBundle(taskId),
        projectService.getMembersCached(projectId).catch(() => []),
        sprintService.listByProject(projectId).catch(() => []),
        projectService.getMilestones(projectId).catch(() => []),
      ]);

      setBundle(detail);
      setMembers(projectMembers);
      setSprints((projectSprints as any[]).map(s => ({ id: s.id, label: s.sprintName || s.name || `Sprint #${s.id}` })));
      setMilestones((projectMilestones as any[]).map(m => ({ id: m.id, label: m.name || `Milestone #${m.id}` })));

      const loaded = detail.task ?? {};
      setTitle(loaded.title ?? '');
      setDescription(loaded.description ?? '');
      setStatus(loaded.status ?? 'TODO');
      setPriority(loaded.priority ?? 'MEDIUM');
      setStoryPoint(String(loaded.storyPoint ?? ''));
      setStartDate(formatDateInput(loaded.startDate));
      setDueDate(formatDateInput(loaded.dueDate));
      setSprintId(loaded.sprintId ?? null);
      setMilestoneId(loaded.milestoneId ?? null);
      const matchingMember = projectMembers.find((member: any) =>
        loaded.assigneeId === memberUserId(member) ||
        loaded.assigneeName === memberLabel(member)
      );
      setAssigneeId(matchingMember ? memberUserId(matchingMember) : null);
      void taskDetailService.recordAccess(taskId).catch(() => {});
    } catch (err) {
      Alert.alert('Task not loaded', apiErrorMessage(err, 'Please try again.'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose, projectId, taskId, visible]);

  useEffect(() => {
    if (visible) void load();
    if (!visible) {
      setBundle(null);
      setComment('');
    }
  }, [load, visible]);

  const assigneeOptions = useMemo(() => (
    members.map((member) => ({ id: memberUserId(member), label: memberLabel(member) })).filter((member) => member.id)
  ), [members]);

  const save = async () => {
    if (!taskId) return;
    if (!title.trim()) {
      Alert.alert('Validation', 'Task title is required.');
      return;
    }

    setSaving(true);
    try {
      await taskDetailService.updateTask(taskId, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority: priority as any,
        storyPoint: storyPoint.trim() ? Number(storyPoint) : 0,
        startDate: startDate.trim() || null,
        dueDate: dueDate.trim() || null,
        sprintId,
        milestoneId,
      });

      if (assigneeId) {
        await taskService.assignTaskSingle(taskId, assigneeId);
      } else {
        await taskService.unassignTask(taskId);
      }

      await load();
      onChanged?.();
    } catch (err) {
      Alert.alert('Task not saved', apiErrorMessage(err, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!taskId || !comment.trim()) return;
    const content = comment.trim();
    setComment('');
    try {
      await taskDetailService.addComment(taskId, content);
      await load();
      onChanged?.();
    } catch (err) {
      setComment(content);
      Alert.alert('Comment not added', apiErrorMessage(err, 'Please try again.'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={22} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Task Detail</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {task?.projectTaskNumber ? `TSK-${task.projectTaskNumber}` : taskId ? `#${taskId}` : 'Task'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <MaterialCommunityIcons name="close" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={T.primary} />
              <Text style={styles.muted}>Loading task...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <View style={styles.section}>
                <FieldLabel>Title</FieldLabel>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Task title" />

                <FieldLabel>Description</FieldLabel>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add task details..."
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.section}>
                <FieldLabel>Status</FieldLabel>
                <View style={styles.wrapRow}>
                  {STATUSES.map(item => (
                    <Chip key={item} label={item.replace(/_/g, ' ')} active={status === item} onPress={() => setStatus(item)} />
                  ))}
                </View>

                <FieldLabel>Priority</FieldLabel>
                <View style={styles.wrapRow}>
                  {PRIORITIES.map(item => (
                    <Chip key={item} label={item} active={priority === item} onPress={() => setPriority(item)} />
                  ))}
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Start Date</FieldLabel>
                  <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Due Date</FieldLabel>
                  <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Story Points</FieldLabel>
                  <TextInput style={styles.input} value={storyPoint} onChangeText={setStoryPoint} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Assignee</FieldLabel>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.horizontalChips}>
                      <Chip label="Unassigned" active={assigneeId == null} onPress={() => setAssigneeId(null)} />
                      {assigneeOptions.map(member => (
                        <Chip key={member.id} label={member.label} active={assigneeId === member.id} onPress={() => setAssigneeId(member.id)} />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={styles.section}>
                <FieldLabel>Sprint</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.horizontalChips}>
                    <Chip label="Backlog" active={sprintId == null} onPress={() => setSprintId(null)} />
                    {sprints.map(item => (
                      <Chip key={item.id} label={item.label} active={sprintId === item.id} onPress={() => setSprintId(item.id)} />
                    ))}
                  </View>
                </ScrollView>

                <FieldLabel>Milestone</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.horizontalChips}>
                    <Chip label="None" active={milestoneId == null} onPress={() => setMilestoneId(null)} />
                    {milestones.map(item => (
                      <Chip key={item.id} label={item.label} active={milestoneId === item.id} onPress={() => setMilestoneId(item.id)} />
                    ))}
                  </View>
                </ScrollView>
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} disabled={saving} onPress={save}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Task'}</Text>
              </TouchableOpacity>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comments</Text>
                <View style={styles.commentBox}>
                  <TextInput
                    style={[styles.input, styles.commentInput]}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Add a comment..."
                    multiline
                  />
                  <TouchableOpacity style={styles.commentBtn} onPress={addComment}>
                    <Text style={styles.commentBtnText}>Post</Text>
                  </TouchableOpacity>
                </View>
                {(bundle?.comments ?? []).map(item => (
                  <View key={item.id} style={styles.infoRow}>
                    <Text style={styles.infoTitle}>{item.authorName || item.user?.fullName || item.user?.username || 'Teammate'}</Text>
                    <Text style={styles.infoText}>{item.content}</Text>
                  </View>
                ))}
                {bundle?.comments.length === 0 ? <Text style={styles.emptyText}>No comments yet.</Text> : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <Text style={styles.infoText}>Custom fields: {bundle?.customFields.length ?? 0}</Text>
                <Text style={styles.infoText}>Attachments: {bundle?.attachments.length ?? 0}</Text>
                <Text style={styles.infoText}>Activities: {bundle?.activities.length ?? 0}</Text>
                {task?.recurrenceRule ? <Text style={styles.infoText}>Recurrence: {task.recurrenceRule}</Text> : null}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: T.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: T.textMuted, fontWeight: '700', marginTop: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: T.textMuted, fontSize: 13, fontWeight: '600' },
  content: { paddingBottom: 18, gap: 14 },
  section: { gap: 9 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: T.textPrimary, letterSpacing: 0.2, textTransform: 'uppercase' },
  label: { fontSize: 11, fontWeight: '900', color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.bgSecondary,
    color: T.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: { minHeight: 86, paddingTop: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalChips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: T.bgSecondary },
  chipActive: { borderColor: T.primary, backgroundColor: T.primaryLight },
  chipText: { fontSize: 12, fontWeight: '800', color: T.textSecondary },
  chipTextActive: { color: T.primary },
  twoCol: { flexDirection: 'row', gap: 10 },
  saveBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary, borderRadius: 14, paddingVertical: 13 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.6 },
  commentBox: { gap: 8 },
  commentInput: { minHeight: 70, textAlignVertical: 'top' },
  commentBtn: { alignSelf: 'flex-end', backgroundColor: T.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  commentBtnText: { color: T.primary, fontSize: 13, fontWeight: '900' },
  infoRow: { borderWidth: 1, borderColor: T.borderLight, backgroundColor: T.bgSecondary, borderRadius: 12, padding: 11 },
  infoTitle: { fontSize: 12, fontWeight: '900', color: T.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 12.5, color: T.textSecondary, lineHeight: 18 },
  emptyText: { color: T.textMuted, fontSize: 12.5, textAlign: 'center', paddingVertical: 8 },
});
