export const ACCESS_DENIED_TITLE = 'Access Denied';
export const ACCESS_DENIED_MESSAGE =
  "You don't have permission to perform this action. Only the project owner and admin can perform this action.";

/**
 * Checks if the given role string has project owner or admin privileges.
 */
export function isProjectOwnerOrAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  return normalized === 'OWNER' || normalized === 'ADMIN';
}

/**
 * Resolves the effective project role for the current user given the project owner and members list.
 */
export function resolveCurrentUserProjectRole(
  currentUser: { userId?: number; email?: string } | null | undefined,
  project: { ownerId?: number | null; [key: string]: unknown } | null | undefined,
  members: Array<{ user?: { userId?: number | null; email?: string | null } | null; role?: string | null }> | null | undefined
): string | null {
  if (!currentUser) return null;

  if (typeof currentUser.userId === 'number' && typeof project?.ownerId === 'number' && currentUser.userId === project.ownerId) {
    return 'OWNER';
  }

  if (Array.isArray(members)) {
    const matchedMember = members.find((m) => {
      const matchId = typeof currentUser.userId === 'number' && m.user?.userId === currentUser.userId;
      const matchEmail =
        currentUser.email &&
        m.user?.email &&
        m.user.email.toLowerCase() === currentUser.email.toLowerCase();
      return matchId || matchEmail;
    });

    if (matchedMember?.role) {
      return matchedMember.role.trim().toUpperCase();
    }
  }

  return null;
}
