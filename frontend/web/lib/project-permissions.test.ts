import {
  isProjectOwnerOrAdmin,
  resolveCurrentUserProjectRole,
  ACCESS_DENIED_TITLE,
  ACCESS_DENIED_MESSAGE,
} from './project-permissions';

describe('project-permissions', () => {
  describe('constants', () => {
    it('has the correct title and message', () => {
      expect(ACCESS_DENIED_TITLE).toBe('Access Denied');
      expect(ACCESS_DENIED_MESSAGE).toBe(
        "You don't have permission to perform this action. Only the project owner and admin can perform this action."
      );
    });
  });

  describe('isProjectOwnerOrAdmin', () => {
    it('returns true for OWNER in any case', () => {
      expect(isProjectOwnerOrAdmin('OWNER')).toBe(true);
      expect(isProjectOwnerOrAdmin('owner')).toBe(true);
      expect(isProjectOwnerOrAdmin(' Owner ')).toBe(true);
    });

    it('returns true for ADMIN in any case', () => {
      expect(isProjectOwnerOrAdmin('ADMIN')).toBe(true);
      expect(isProjectOwnerOrAdmin('admin')).toBe(true);
      expect(isProjectOwnerOrAdmin(' Admin ')).toBe(true);
    });

    it('returns false for MEMBER, VIEWER, null, and undefined', () => {
      expect(isProjectOwnerOrAdmin('MEMBER')).toBe(false);
      expect(isProjectOwnerOrAdmin('member')).toBe(false);
      expect(isProjectOwnerOrAdmin('VIEWER')).toBe(false);
      expect(isProjectOwnerOrAdmin('viewer')).toBe(false);
      expect(isProjectOwnerOrAdmin(null)).toBe(false);
      expect(isProjectOwnerOrAdmin(undefined)).toBe(false);
      expect(isProjectOwnerOrAdmin('')).toBe(false);
    });
  });

  describe('resolveCurrentUserProjectRole', () => {
    const currentUser = { userId: 10, email: 'john@example.com' };
    const project = { ownerId: 10 };
    const members = [
      { user: { userId: 10, email: 'john@example.com' }, role: 'MEMBER' },
      { user: { userId: 20, email: 'jane@example.com' }, role: 'ADMIN' },
      { user: { userId: 30, email: 'bob@example.com' }, role: 'MEMBER' },
    ];

    it('returns OWNER if currentUser.userId matches project.ownerId', () => {
      expect(resolveCurrentUserProjectRole(currentUser, project, members)).toBe('OWNER');
    });

    it('returns role from members list if currentUser is not project owner', () => {
      const adminUser = { userId: 20, email: 'jane@example.com' };
      const nonOwnerProject = { ownerId: 99 };
      expect(resolveCurrentUserProjectRole(adminUser, nonOwnerProject, members)).toBe('ADMIN');

      const memberUser = { userId: 30, email: 'bob@example.com' };
      expect(resolveCurrentUserProjectRole(memberUser, nonOwnerProject, members)).toBe('MEMBER');
    });

    it('matches by email if userId does not match', () => {
      const emailUser = { userId: 999, email: 'jane@example.com' };
      const nonOwnerProject = { ownerId: 99 };
      expect(resolveCurrentUserProjectRole(emailUser, nonOwnerProject, members)).toBe('ADMIN');
    });

    it('returns null if currentUser is not found in members and not owner', () => {
      const unknownUser = { userId: 888, email: 'unknown@example.com' };
      const nonOwnerProject = { ownerId: 99 };
      expect(resolveCurrentUserProjectRole(unknownUser, nonOwnerProject, members)).toBeNull();
    });

    it('returns null if currentUser is missing', () => {
      expect(resolveCurrentUserProjectRole(null, project, members)).toBeNull();
    });
  });
});
