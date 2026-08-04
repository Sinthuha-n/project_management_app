export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type AssignableTeamRole = Exclude<TeamRole, 'OWNER'>;

export interface Member {
  id: number;
  role: TeamRole;
  user: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    profilePicUrl?: string;
  };
  lastActive?: string;
  taskCount: number;
  status: string;
}

export interface PendingInvite {
  id: number;
  email: string;
  invitedAt: string;
  status: string;
  role: AssignableTeamRole;
}

export type MemberCombined = Member & { invitedAt?: string };

export interface MembersCachePayload {
  members: Member[];
  pending: PendingInvite[];
  projectOwnerId?: number | null;
  timestamp: number;
}
