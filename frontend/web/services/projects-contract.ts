import api from '@/lib/axios';
import { createProject as createProjectBuilder } from '@planora/contracts';
import type { CreateProjectRequest } from '@planora/contracts';
import type { ProjectMetrics } from '@/types';

export interface ProjectCustomFieldDto {
  id: number;
  name: string;
  fieldType: string;
  options?: string[];
  position?: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  projectKey?: string;
  type?: 'AGILE' | 'KANBAN';
  teamId?: number;
  teamName?: string;
  ownerId?: number;
  ownerName?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isFavorite?: boolean;
  [key: string]: unknown;
}

export interface Member {
  id: number;
  role?: string;
  joinedAt?: string;
  userId?: number;
  username?: string;
  email?: string;
  githubUsername?: string | null;
  githubEmail?: string | null;
  user?: {
    userId: number;
    username: string;
    email?: string;
    githubUsername?: string | null;
    githubEmail?: string | null;
    profilePicUrl?: string | null;
  };
}

export interface PendingInvite {
  id: number;
  email: string;
  role: string;
  invitedAt: string;
}

export interface PortfolioProject {
  id: number;
  name: string;
  projectKey: string;
  description?: string;
  type: 'AGILE' | 'KANBAN';
  ownerId: number;
  ownerName: string;
  teamId: number;
  teamName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Portfolio {
  id: number;
  name: string;
  description?: string;
  color: string;
  emoji?: string;
  ownerId: number;
  ownerName: string;
  projectCount: number;
  projects?: PortfolioProject[];
  totalTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
  totalMembers?: number;
  healthScore?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePortfolioPayload {
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  projectIds?: number[];
}

export const projectsApi = {
  list: async (): Promise<ProjectSummary[]> => {
    const { data } = await api.get('/api/projects');
    return data;
  },
  getRecent: async (limit = 10): Promise<ProjectSummary[]> => {
    const { data } = await api.get('/api/projects/recent', { params: { limit } });
    return data;
  },
  getFavorites: async (): Promise<ProjectSummary[]> => {
    const { data } = await api.get('/api/projects/favorites');
    return data;
  },
  get: async (projectId: number | string): Promise<ProjectSummary> => {
    const { data } = await api.get(`/api/projects/${projectId}`);
    return data;
  },
  getMetrics: async (projectId: number | string): Promise<ProjectMetrics> => {
    const { data } = await api.get(`/api/projects/${projectId}/metrics`);
    return data;
  },
  recordAccess: async (projectId: number | string): Promise<void> => {
    await api.post(`/api/projects/${projectId}/access`);
  },
  toggleFavorite: async (projectId: number | string): Promise<void> => {
    await api.post(`/api/projects/${projectId}/favorite`);
  },
  update: async (projectId: number | string, payload: Record<string, unknown>): Promise<ProjectSummary> => {
    const { data } = await api.put(`/api/projects/${projectId}`, payload);
    return data;
  },
  delete: async (projectId: number | string, teamId: number | string): Promise<void> => {
    await api.delete(`/api/projects/${projectId}/team/${teamId}`);
  },
  leave: async (projectId: number | string): Promise<void> => {
    await api.post(`/api/projects/${projectId}/leave`);
  },
  getMembers: async (projectId: number | string): Promise<Member[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/members`);
    return data;
  },
  getPendingInvites: async (projectId: number | string): Promise<PendingInvite[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/pending-invites`);
    return data;
  },
  changeMemberRole: async (projectId: number | string, userId: number, role: string): Promise<void> => {
    await api.patch(`/api/projects/${projectId}/members/${userId}/role`, { role });
  },
  removeMember: async (projectId: number | string, userId: number): Promise<void> => {
    await api.delete(`/api/projects/${projectId}/members/${userId}`);
  },
  sendInvite: async (projectId: number | string, email: string, role: string): Promise<void> => {
    await api.post(`/api/projects/${projectId}/invitations`, { email, role });
  },
  acceptInvitation: async (token: string): Promise<void> => {
    await api.post('/api/projects/invitations/accept', { token });
  },
  checkKey: async (key: string): Promise<boolean> => {
    const { data } = await api.get(`/api/projects/check-key?key=${encodeURIComponent(key)}`);
    return data;
  },
  checkTeamName: async (name: string): Promise<{ exists: boolean; isMember: boolean }> => {
    const { data } = await api.get(`/api/teams/check-name?name=${encodeURIComponent(name)}`);
    return data;
  },
  create: async (payload: CreateProjectRequest): Promise<ProjectSummary> => {
    const { data } = await createProjectBuilder(api, payload);
    return data;
  },
  getCustomFields: async (projectId: number | string): Promise<ProjectCustomFieldDto[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/custom-fields`);
    return data;
  },
  createCustomField: async (projectId: number | string, payload: Record<string, unknown>): Promise<ProjectCustomFieldDto> => {
    const { data } = await api.post(`/api/projects/${projectId}/custom-fields`, payload);
    return data;
  },
  deleteCustomField: async (projectId: number | string, fieldId: number | string): Promise<void> => {
    await api.delete(`/api/projects/${projectId}/custom-fields/${fieldId}`);
  },
  getTeamMembers: async (teamId: number | string): Promise<unknown> => {
    const { data } = await api.get(`/api/teams/${teamId}/members`);
    return data;
  },
};

export const portfoliosApi = {
  list: async (): Promise<Portfolio[]> => {
    const { data } = await api.get('/api/portfolios');
    return data;
  },
  get: async (id: number): Promise<Portfolio> => {
    const { data } = await api.get(`/api/portfolios/${id}`);
    return data;
  },
  create: async (payload: CreatePortfolioPayload): Promise<Portfolio> => {
    const { data } = await api.post('/api/portfolios', payload);
    return data;
  },
  update: async (id: number, payload: Partial<CreatePortfolioPayload>): Promise<Portfolio> => {
    const { data } = await api.put(`/api/portfolios/${id}`, payload);
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/api/portfolios/${id}`);
  },
  addProject: async (portfolioId: number, projectId: number): Promise<Portfolio> => {
    const { data } = await api.post(`/api/portfolios/${portfolioId}/projects/${projectId}`);
    return data;
  },
  removeProject: async (portfolioId: number, projectId: number): Promise<void> => {
    await api.delete(`/api/portfolios/${portfolioId}/projects/${projectId}`);
  },
};
