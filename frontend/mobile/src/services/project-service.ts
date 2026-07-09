import api from '../api/axios';

export type ProjectType = 'AGILE' | 'KANBAN';

export interface ProjectDetails {
  id: number;
  name: string;
  projectKey?: string;
  key?: string;
  description?: string;
  type?: ProjectType;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number;
  ownerName?: string;
  teamId?: number;
  teamName?: string;
  isFavorite?: boolean;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
}

export type ProjectMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface PendingProjectInvite {
  id: number;
  email: string;
  invitedAt?: string;
  status?: string;
  role?: ProjectMemberRole;
}

const MEMBERS_CACHE_TTL_MS = 60_000;
const membersCache = new Map<string, { data: any[]; expiresAt: number; inFlight?: Promise<any[]> }>();

function readFreshMembers(projectId: number | string) {
  const key = String(projectId);
  const cached = membersCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached;
}

export const projectService = {
  get: (projectId: number | string): Promise<ProjectDetails> =>
    api.get<ProjectDetails>(`/api/projects/${projectId}`).then(r => r.data),

  update: (projectId: number | string, payload: UpdateProjectPayload): Promise<ProjectDetails> =>
    api.put<ProjectDetails>(`/api/projects/${projectId}`, payload).then(r => r.data),

  remove: (projectId: number | string, teamId: number | string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/team/${teamId}`).then(() => undefined),

  leave: (projectId: number | string): Promise<void> =>
    api.post(`/api/projects/${projectId}/leave`).then(() => undefined),

  getMembers: (projectId: number | string): Promise<any[]> =>
    api.get<any[]>(`/api/projects/${projectId}/members`).then(r => r.data),

  getPendingInvites: (projectId: number | string): Promise<PendingProjectInvite[]> =>
    api.get<PendingProjectInvite[]>(`/api/projects/${projectId}/pending-invites`).then(r => r.data ?? []),

  inviteMember: (
    projectId: number | string,
    payload: { email: string; role: Exclude<ProjectMemberRole, 'OWNER'> },
  ): Promise<void> =>
    api.post(`/api/projects/${projectId}/invitations`, payload).then(() => undefined),

  changeMemberRole: (
    projectId: number | string,
    userId: number | string,
    role: ProjectMemberRole,
  ): Promise<void> =>
    api.patch(`/api/projects/${projectId}/members/${userId}/role`, { role }).then(() => undefined),

  removeMember: (projectId: number | string, userId: number | string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/members/${userId}`).then(() => undefined),

  acceptInvitation: (token: string): Promise<void> =>
    api.post('/api/projects/invitations/accept', { token }).then(() => undefined),

  getMembersCached: (projectId: number | string, options: { force?: boolean } = {}): Promise<any[]> => {
    const key = String(projectId);
    const existing = membersCache.get(key);
    if (!options.force && existing?.inFlight) return existing.inFlight;
    const cached = readFreshMembers(projectId);
    if (!options.force && cached?.data) return Promise.resolve(cached.data);

    const inFlight = api.get<any[]>(`/api/projects/${projectId}/members`).then((r) => {
      const data = Array.isArray(r.data) ? r.data : [];
      membersCache.set(key, { data, expiresAt: Date.now() + MEMBERS_CACHE_TTL_MS });
      return data;
    }).catch((error) => {
      const existing = membersCache.get(key);
      if (existing?.data) {
        membersCache.set(key, { data: existing.data, expiresAt: existing.expiresAt });
      } else {
        membersCache.delete(key);
      }
      throw error;
    });

    membersCache.set(key, { data: existing?.data ?? [], expiresAt: existing?.expiresAt ?? 0, inFlight });
    return inFlight;
  },

  clearMembersCache: (projectId?: number | string): void => {
    if (projectId === undefined) membersCache.clear();
    else membersCache.delete(String(projectId));
  },

  getMetrics: (projectId: number | string): Promise<any> =>
    api.get(`/api/projects/${projectId}/metrics`).then(r => r.data),

  getMilestones: (projectId: number | string): Promise<any[]> =>
    api.get<any[]>(`/api/projects/${projectId}/milestones`).then(r => r.data),

  // ── Custom fields ──────────────────────────────────────────────────────────
  getCustomFields: (projectId: number | string): Promise<CustomFieldDto[]> =>
    api.get<CustomFieldDto[]>(`/api/projects/${projectId}/custom-fields`).then(r => r.data ?? []),

  createCustomField: (projectId: number | string, payload: CreateCustomFieldPayload): Promise<CustomFieldDto> =>
    api.post<CustomFieldDto>(`/api/projects/${projectId}/custom-fields`, payload).then(r => r.data),

  deleteCustomField: (projectId: number | string, fieldId: number | string): Promise<void> =>
    api.delete(`/api/projects/${projectId}/custom-fields/${fieldId}`).then(() => undefined),
};

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';

export interface CustomFieldDto {
  id: number;
  name: string;
  fieldType: CustomFieldType;
  options?: string[] | null;
  position?: number;
}

export interface CreateCustomFieldPayload {
  name: string;
  fieldType: CustomFieldType;
  options: string[];
  position: number;
}
