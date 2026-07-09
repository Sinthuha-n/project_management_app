import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import api from '../../api/axios';
import { T } from '../../constants/tokens';
import { projectService, ProjectMemberRole } from '../../services/project-service';

type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | string;
type MemberStatus = 'Active' | 'Pending' | string;

interface ProjectMember {
  id: number;
  role: MemberRole;
  user: {
    userId?: number;
    username?: string;
    fullName?: string;
    email: string;
    profilePicUrl?: string;
  };
  lastActive?: string;
  taskCount?: number;
  status?: MemberStatus;
}

interface PendingInvite {
  id: number;
  email: string;
  invitedAt?: string;
  status?: string;
  role?: MemberRole;
}

type MemberRow = ProjectMember & { invitedAt?: string };

interface MobileMembersScreenProps {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}

const ROLE_META: Record<string, { label: string; bg: string; text: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  OWNER: { label: 'Owner', bg: '#FEF3C7', text: '#92400E', icon: 'crown-outline' },
  ADMIN: { label: 'Admin', bg: T.primaryLight, text: T.primary, icon: 'shield-star-outline' },
  MEMBER: { label: 'Member', bg: '#E0F2FE', text: '#0369A1', icon: 'account-outline' },
  VIEWER: { label: 'Viewer', bg: '#F1F5F9', text: '#475569', icon: 'eye-outline' },
};

const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  Active: { bg: '#ECFDF5', text: '#047857', dot: '#10B981' },
  Pending: { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
};

function memberName(member: MemberRow) {
  return member.user.fullName || member.user.username || member.user.email;
}

function initialsFor(member: MemberRow) {
  const source = member.user.fullName || member.user.username || member.user.email;
  return source
    .split(/[ @._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

function formatLastActive(member: MemberRow) {
  if ((member.status || 'Active') === 'Pending') return 'Never';
  if (!member.lastActive) return '-';

  const date = new Date(member.lastActive);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function makePendingMember(invite: PendingInvite): MemberRow {
  return {
    id: -Math.abs(invite.id),
    role: invite.role || 'MEMBER',
    status: 'Pending',
    invitedAt: invite.invitedAt,
    taskCount: 0,
    user: {
      email: invite.email,
      fullName: invite.email,
    },
  };
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}14` }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Chip({
  label,
  icon,
  bg,
  text,
}: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  text: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={text} /> : null}
      <Text style={[styles.chipText, { color: text }]}>{label}</Text>
    </View>
  );
}

function MemberCard({
  member,
  onChangeRole,
  onRemove,
}: {
  member: MemberRow;
  onChangeRole: (role: ProjectMemberRole) => void;
  onRemove: () => void;
}) {
  const role = ROLE_META[member.role] || { label: member.role, bg: '#F1F5F9', text: '#475569', icon: 'account-outline' as const };
  const statusValue = member.status || 'Active';
  const status = STATUS_META[statusValue] || STATUS_META.Active;
  const isPending = statusValue === 'Pending';
  const isOwner = member.role === 'OWNER';

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTopRow}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            {member.user.profilePicUrl ? (
              <Image source={{ uri: member.user.profilePicUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initialsFor(member)}</Text>
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.memberName} numberOfLines={1}>{memberName(member)}</Text>
            <Text style={styles.memberEmail} numberOfLines={1}>{member.user.email}</Text>
          </View>
        </View>
        <Chip label={statusValue} bg={status.bg} text={status.text} />
      </View>

      <View style={styles.memberMetaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Role</Text>
          <Chip label={role.label} icon={role.icon} bg={role.bg} text={role.text} />
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Tasks</Text>
          <Text style={styles.metaValue}>{member.taskCount ?? 0}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Last active</Text>
          <Text style={styles.metaValue}>{formatLastActive(member)}</Text>
        </View>
      </View>
      {!isPending && !isOwner ? (
        <View style={styles.memberActions}>
          {(['ADMIN', 'MEMBER', 'VIEWER'] as ProjectMemberRole[]).map((roleOption) => (
            <TouchableOpacity
              key={roleOption}
              activeOpacity={0.78}
              onPress={() => onChangeRole(roleOption)}
              disabled={member.role === roleOption}
              style={[styles.roleBtn, member.role === roleOption && styles.roleBtnActive]}
            >
              <Text style={[styles.roleBtnText, member.role === roleOption && styles.roleBtnTextActive]}>
                {roleOption}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity activeOpacity={0.78} onPress={onRemove} style={styles.removeBtn}>
            <MaterialCommunityIcons name="account-remove-outline" size={15} color="#DC2626" />
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function MembersSkeleton({ topOffset }: { topOffset: number }) {
  return (
    <View style={[styles.centerState, { paddingTop: topOffset }]}>
      <ActivityIndicator size="large" color={T.primary} />
      <Text style={styles.centerText}>Loading members...</Text>
    </View>
  );
}

export default function MobileMembersScreen({
  projectId,
  projectName,
  topOffset = 0,
}: MobileMembersScreenProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectMemberRole, 'OWNER'>>('MEMBER');
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadMembers = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!projectId || Number.isNaN(projectId)) return;

    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError('');

    try {
      const [membersRes, pendingRes] = await Promise.all([
        api.get<ProjectMember[]>(`/api/projects/${projectId}/members`),
        api.get<PendingInvite[]>(`/api/projects/${projectId}/pending-invites`).catch(() => ({ data: [] as PendingInvite[] })),
      ]);

      const activeMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
      const pendingMembers = Array.isArray(pendingRes.data) ? pendingRes.data.map(makePendingMember) : [];
      setMembers([...activeMembers, ...pendingMembers]);
    } catch {
      setError('Unable to load members right now.');
      setMembers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;

    return members.filter((member) => (
      memberName(member).toLowerCase().includes(normalized) ||
      member.user.email.toLowerCase().includes(normalized) ||
      member.role.toLowerCase().includes(normalized) ||
      (member.status || 'Active').toLowerCase().includes(normalized)
    ));
  }, [members, query]);

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((member) => (member.status || 'Active') === 'Active').length,
    admins: members.filter((member) => member.role === 'OWNER' || member.role === 'ADMIN').length,
    pending: members.filter((member) => (member.status || 'Active') === 'Pending').length,
  }), [members]);

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteBusy(true);
    try {
      await projectService.inviteMember(projectId, { email, role: inviteRole });
      setInviteEmail('');
      await loadMembers('refresh');
    } catch (err) {
      Alert.alert('Invite failed', String((err as any)?.response?.data?.message ?? 'Please try again.'));
    } finally {
      setInviteBusy(false);
    }
  };

  const changeRole = (member: MemberRow, role: ProjectMemberRole) => {
    const userId = member.user.userId;
    if (!userId) return;
    Alert.alert('Change role', `Change ${memberName(member)} to ${role}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change',
        onPress: async () => {
          try {
            await projectService.changeMemberRole(projectId, userId, role);
            await loadMembers('refresh');
          } catch (err) {
            Alert.alert('Role not changed', String((err as any)?.response?.data?.message ?? 'Please try again.'));
          }
        },
      },
    ]);
  };

  const removeMember = (member: MemberRow) => {
    const userId = member.user.userId;
    if (!userId) return;
    Alert.alert('Remove member', `Remove ${memberName(member)} from this project?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await projectService.removeMember(projectId, userId);
            await loadMembers('refresh');
          } catch (err) {
            Alert.alert('Member not removed', String((err as any)?.response?.data?.message ?? 'Please try again.'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <MembersSkeleton topOffset={topOffset} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topOffset }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadMembers('refresh')}
          tintColor={T.primary}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Team directory</Text>
          <Text style={styles.title}>Members</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{projectName || 'Project team'}</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="account-group-outline" size={24} color={T.primary} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} icon="account-group-outline" color={T.primary} />
        <StatCard label="Active" value={stats.active} icon="pulse" color="#10B981" />
        <StatCard label="Admins" value={stats.admins} icon="shield-star-outline" color="#7C3AED" />
        <StatCard label="Pending" value={stats.pending} icon="clock-outline" color="#F59E0B" />
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={20} color={T.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search members"
          placeholderTextColor={T.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <View style={styles.inviteCard}>
        <Text style={styles.sectionTitle}>Invite teammate</Text>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="teammate@example.com"
          placeholderTextColor={T.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.inviteInput}
        />
        <View style={styles.inviteRoleRow}>
          {(['ADMIN', 'MEMBER', 'VIEWER'] as const).map((role) => (
            <TouchableOpacity
              key={role}
              activeOpacity={0.78}
              onPress={() => setInviteRole(role)}
              style={[styles.roleBtn, inviteRole === role && styles.roleBtnActive]}
            >
              <Text style={[styles.roleBtnText, inviteRole === role && styles.roleBtnTextActive]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={inviteBusy || !inviteEmail.trim()}
          onPress={sendInvite}
          style={[styles.inviteBtn, (inviteBusy || !inviteEmail.trim()) && styles.inviteBtnDisabled]}
        >
          {inviteBusy ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="send-outline" size={16} color="#fff" />}
          <Text style={styles.inviteBtnText}>{inviteBusy ? 'Sending...' : 'Send Invite'}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Team</Text>
        <Text style={styles.sectionCount}>{filteredMembers.length} shown</Text>
      </View>

      {filteredMembers.map((member) => (
        <MemberCard
          key={`${member.id}-${member.user.email}`}
          member={member}
          onChangeRole={(role) => changeRole(member, role)}
          onRemove={() => removeMember(member)}
        />
      ))}

      {!filteredMembers.length ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="account-search-outline" size={28} color={T.textMuted} />
          <Text style={styles.emptyTitle}>No members found</Text>
          <Text style={styles.emptyText}>Try another name, email, role, or status.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bgSecondary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bgSecondary,
    gap: 12,
  },
  centerText: {
    color: T.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    color: T.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: T.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    maxWidth: 240,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primaryLight,
    borderWidth: 1,
    borderColor: '#D9E7FF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 92,
    backgroundColor: T.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: T.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: T.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: T.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 10,
  },
  inviteInput: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: T.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: T.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  inviteBtnDisabled: { opacity: 0.55 },
  inviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  errorCard: {
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  listHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: T.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionCount: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  memberCard: {
    backgroundColor: T.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 14,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  identityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: T.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  memberEmail: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  memberMetaGrid: {
    borderRadius: 12,
    backgroundColor: T.bgSecondary,
    padding: 12,
    gap: 12,
  },
  metaCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metaValue: {
    color: T.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.borderLight,
  },
  roleBtn: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: T.bgSecondary,
  },
  roleBtnActive: {
    borderColor: T.primary,
    backgroundColor: T.primaryLight,
  },
  roleBtnText: {
    color: T.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  roleBtnTextActive: { color: T.primary },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
  },
  chip: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '900',
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    marginTop: 10,
    color: T.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 4,
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
