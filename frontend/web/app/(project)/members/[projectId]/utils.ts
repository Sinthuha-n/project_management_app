import type { AssignableTeamRole, Member, MemberCombined, PendingInvite, TeamRole } from './types';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

const MEMBERS_CACHE_KEY_PREFIX = 'planora:members:';

export function getMembersCacheKey(projectId: string): string {
  return `${MEMBERS_CACHE_KEY_PREFIX}${projectId}`;
}

export function timeAgo(dateString?: string): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return '1 day ago';
  return `${Math.floor(diff / 86400)} days ago`;
}

export function buildCombinedMembers(members: Member[], pending: PendingInvite[]): MemberCombined[] {
  return [
    ...members,
    ...pending.map((invite) => {
      const normalizedRole = normalizeTeamRole(invite.role);
      const role: AssignableTeamRole = normalizedRole && normalizedRole !== 'OWNER' ? normalizedRole : 'MEMBER';
      return {
        id: invite.id,
        role,
        user: {
          userId: 0,
          username: '',
          fullName: '',
          email: invite.email,
          profilePicUrl: undefined,
        },
        lastActive: undefined,
        taskCount: 0,
        status: 'Pending',
        invitedAt: invite.invitedAt,
      };
    }),
  ];
}

export function applyProjectOwnerRole(members: Member[], projectOwnerId?: number | null): Member[] {
  if (typeof projectOwnerId !== 'number') return members;

  let changed = false;
  const normalizedMembers = members.map((member) => {
    if (member.user.userId !== projectOwnerId || member.role === 'OWNER') {
      return member;
    }

    changed = true;
    return { ...member, role: 'OWNER' as const };
  });

  return changed ? normalizedMembers : members;
}

export function resolveProjectOwnerId(project: unknown): number | null {
  if (!project || typeof project !== 'object') return null;

  const record = project as Record<string, unknown>;
  const candidateKeys = ['ownerId', 'createdByUserId', 'createdById'];

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  const owner = record.owner;
  if (owner && typeof owner === 'object') {
    const ownerRecord = owner as Record<string, unknown>;
    for (const key of ['userId', 'id']) {
      const value = ownerRecord[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }

  return null;
}

export function normalizeTeamRole(role?: string | null): TeamRole | null {
  const normalized = role?.trim().toUpperCase();
  if (normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'MEMBER' || normalized === 'VIEWER') {
    return normalized;
  }
  return null;
}

function isCurrentUser(
  currentUserId: number | null,
  currentUserEmail: string | null,
  targetMember: MemberCombined,
): boolean {
  if (currentUserId !== null && targetMember.user.userId === currentUserId) return true;
  return Boolean(currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail);
}

export function getAllowedRoleOptions(
  currentUserRole: string | null,
  currentUserId: number | null,
  currentUserEmail: string | null,
  targetMember: MemberCombined,
): AssignableTeamRole[] {
  const currentRole = normalizeTeamRole(currentUserRole);
  const targetRole = normalizeTeamRole(targetMember.role);

  if (targetMember.status === 'Pending' || !targetRole || targetRole === 'OWNER') return [];
  if (isCurrentUser(currentUserId, currentUserEmail, targetMember)) return [];
  if (currentRole === 'OWNER') return ['ADMIN', 'MEMBER', 'VIEWER'];
  if (currentRole === 'ADMIN' && (targetRole === 'MEMBER' || targetRole === 'VIEWER')) {
    return ['MEMBER', 'VIEWER'];
  }

  return [];
}

export function canRemoveMember(
  currentUserRole: string | null,
  currentUserId: number | null,
  currentUserEmail: string | null,
  targetMember: MemberCombined,
): boolean {
  const currentRole = normalizeTeamRole(currentUserRole);
  const targetRole = normalizeTeamRole(targetMember.role);

  if (targetMember.status === 'Pending' || !targetRole || targetRole === 'OWNER') return false;
  if (isCurrentUser(currentUserId, currentUserEmail, targetMember)) return false;
  if (currentRole === 'OWNER') return true;
  if (currentRole === 'ADMIN') return targetRole === 'MEMBER' || targetRole === 'VIEWER';

  return false;
}

export function resolveProfilePicUrl(profilePicUrl?: string): string {
  return resolveProfilePhotoUrl(profilePicUrl) || '';
}
