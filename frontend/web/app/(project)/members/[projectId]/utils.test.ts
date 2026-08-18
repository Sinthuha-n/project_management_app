import {
  applyProjectOwnerRole,
  buildCombinedMembers,
  canRemoveMember,
  getAllowedRoleOptions,
  getMembersCacheKey,
  getPageNumbers,
  normalizeTeamRole,
  paginateMembers,
  resolveProfilePicUrl,
  resolveProjectOwnerId,
  timeAgo,
} from './utils';
import type { Member, MemberCombined, PendingInvite } from './types';

describe('members utils', () => {
  describe('getPageNumbers', () => {
    it('returns empty array when totalPages <= 0', () => {
      expect(getPageNumbers(1, 0)).toEqual([]);
      expect(getPageNumbers(1, -5)).toEqual([]);
    });

    it('returns sequential numbers when totalPages <= maxVisible', () => {
      expect(getPageNumbers(1, 5, 7)).toEqual([1, 2, 3, 4, 5]);
      expect(getPageNumbers(3, 7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns start pages with ending ellipsis when currentPage <= 4', () => {
      expect(getPageNumbers(1, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
      expect(getPageNumbers(3, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
      expect(getPageNumbers(4, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    });

    it('returns ending pages with starting ellipsis when currentPage is near end', () => {
      expect(getPageNumbers(7, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
      expect(getPageNumbers(9, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
      expect(getPageNumbers(10, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
    });

    it('returns middle window with both ellipses when currentPage is in the middle', () => {
      expect(getPageNumbers(5, 10, 7)).toEqual([1, '...', 4, 5, 6, '...', 10]);
      expect(getPageNumbers(6, 12, 7)).toEqual([1, '...', 5, 6, 7, '...', 12]);
    });
  });

  describe('paginateMembers', () => {
    const sampleMembers: MemberCombined[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      role: 'MEMBER',
      user: {
        userId: 100 + i,
        username: `user${i + 1}`,
        fullName: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
      },
      taskCount: i,
      status: 'Active',
    }));

    it('returns original list if pageSize <= 0', () => {
      expect(paginateMembers(sampleMembers, 1, 0)).toEqual(sampleMembers);
      expect(paginateMembers(sampleMembers, 1, -1)).toEqual(sampleMembers);
    });

    it('paginates correctly on first page', () => {
      const page1 = paginateMembers(sampleMembers, 1, 5);
      expect(page1).toHaveLength(5);
      expect(page1[0].id).toBe(1);
      expect(page1[4].id).toBe(5);
    });

    it('paginates correctly on second page', () => {
      const page2 = paginateMembers(sampleMembers, 2, 5);
      expect(page2).toHaveLength(5);
      expect(page2[0].id).toBe(6);
      expect(page2[4].id).toBe(10);
    });

    it('paginates partial last page correctly', () => {
      const page3 = paginateMembers(sampleMembers, 3, 5);
      expect(page3).toHaveLength(2);
      expect(page3[0].id).toBe(11);
      expect(page3[1].id).toBe(12);
    });

    it('clamps negative or zero page to 1', () => {
      const page = paginateMembers(sampleMembers, 0, 5);
      expect(page[0].id).toBe(1);
    });
  });

  describe('buildCombinedMembers', () => {
    it('merges active members and pending invites', () => {
      const members: Member[] = [
        {
          id: 1,
          role: 'ADMIN',
          user: { userId: 10, username: 'admin', fullName: 'Admin User', email: 'admin@example.com' },
          taskCount: 5,
          status: 'Active',
        },
      ];

      const pending: PendingInvite[] = [
        {
          id: 99,
          email: 'invited@example.com',
          invitedAt: '2026-01-01T00:00:00Z',
          status: 'Pending',
          role: 'VIEWER',
        },
      ];

      const combined = buildCombinedMembers(members, pending);
      expect(combined).toHaveLength(2);
      expect(combined[0].user.email).toBe('admin@example.com');
      expect(combined[0].status).toBe('Active');
      expect(combined[1].user.email).toBe('invited@example.com');
      expect(combined[1].status).toBe('Pending');
      expect(combined[1].role).toBe('VIEWER');
    });
  });

  describe('applyProjectOwnerRole', () => {
    it('sets OWNER role for the project owner user id', () => {
      const members: Member[] = [
        {
          id: 1,
          role: 'ADMIN',
          user: { userId: 55, username: 'owner', fullName: 'Owner User', email: 'owner@example.com' },
          taskCount: 2,
          status: 'Active',
        },
        {
          id: 2,
          role: 'MEMBER',
          user: { userId: 60, username: 'member', fullName: 'Member User', email: 'member@example.com' },
          taskCount: 1,
          status: 'Active',
        },
      ];

      const updated = applyProjectOwnerRole(members, 55);
      expect(updated[0].role).toBe('OWNER');
      expect(updated[1].role).toBe('MEMBER');
    });
  });

  describe('role helpers and permissions', () => {
    it('normalizes valid team roles and ignores invalid ones', () => {
      expect(normalizeTeamRole('admin')).toBe('ADMIN');
      expect(normalizeTeamRole('OWNER')).toBe('OWNER');
      expect(normalizeTeamRole('invalid')).toBeNull();
      expect(normalizeTeamRole(null)).toBeNull();
    });

    it('returns allowed role options for OWNER and ADMIN', () => {
      const targetMember: MemberCombined = {
        id: 2,
        role: 'MEMBER',
        user: { userId: 200, username: 'bob', fullName: 'Bob', email: 'bob@example.com' },
        taskCount: 0,
        status: 'Active',
      };

      expect(getAllowedRoleOptions('OWNER', 100, 'owner@example.com', targetMember)).toEqual([
        'ADMIN',
        'MEMBER',
        'VIEWER',
      ]);

      expect(getAllowedRoleOptions('ADMIN', 101, 'admin@example.com', targetMember)).toEqual([
        'MEMBER',
        'VIEWER',
      ]);

      expect(getAllowedRoleOptions('MEMBER', 102, 'other@example.com', targetMember)).toEqual([]);
    });

    it('determines if member can be removed', () => {
      const targetMember: MemberCombined = {
        id: 2,
        role: 'MEMBER',
        user: { userId: 200, username: 'bob', fullName: 'Bob', email: 'bob@example.com' },
        taskCount: 0,
        status: 'Active',
      };

      expect(canRemoveMember('OWNER', 100, 'owner@example.com', targetMember)).toBe(true);
      expect(canRemoveMember('ADMIN', 101, 'admin@example.com', targetMember)).toBe(true);
      expect(canRemoveMember('MEMBER', 102, 'other@example.com', targetMember)).toBe(false);
    });
  });
});
