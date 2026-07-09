import type { Member, MemberCombined, PendingInvite } from './types';
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
      const role = typeof invite.role === 'string' && invite.role.length > 0 ? invite.role.toUpperCase() : 'MEMBER';
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
    return { ...member, role: 'OWNER' };
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

export function canManageMember(
  currentUserRole: string | null,
  currentUserEmail: string | null,
  targetMember: MemberCombined,
): boolean {
  if (!currentUserRole) return false;

  const currentRole = String(currentUserRole).toUpperCase().trim();
  const targetRole = String(targetMember.role).toUpperCase().trim();

  if (targetMember.status === 'Pending') return false;
  if (targetRole === 'OWNER') return false;
  if (currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail) return false;
  if (currentRole === 'OWNER') return true;
  if (currentRole === 'ADMIN') return targetRole === 'MEMBER' || targetRole === 'VIEWER';

  return false;
}

export function resolveProfilePicUrl(profilePicUrl?: string): string {
  return resolveProfilePhotoUrl(profilePicUrl) || '';
}
