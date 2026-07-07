import api from '@/lib/axios';
import { PageResponse } from './contract-common';

export interface NotificationPreferenceRow {
  id?: number;
  projectId: number | null;
  eventType: string;
  channel: 'IN_APP' | 'EMAIL';
  enabled: boolean;
}

export interface UpdateNotificationPreferenceRequest {
  projectId: number | null;
  eventType: string;
  channel: 'IN_APP' | 'EMAIL';
  enabled: boolean;
}

export interface NotificationDto {
  id: number;
  message: string;
  type?: string;
  link?: string;
  read: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface NotificationFeedResponse {
  notifications: NotificationDto[];
  unreadCount: number;
}

export interface GithubRepository {
  integrationId: number;
  projectId: number;
  repositoryFullName: string;
  repositoryUrl: string;
  tokenType: string;
  active: boolean;
}

export interface GithubPr {
  id: number;
  integrationId: number;
  githubPrNumber: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  authorLogin: string | null;
  headBranch: string | null;
  baseBranch: string | null;
  githubUrl: string | null;
  linkedTaskId: number | null;
  githubCreatedAt: string | null;
  githubUpdatedAt: string | null;
  mergedAt: string | null;
}

export interface GithubCommit {
  id: number;
  integrationId: number;
  sha: string;
  shortSha: string;
  message: string | null;
  authorName: string | null;
  authorEmail: string | null;
  commitUrl: string | null;
  linkedTaskId: number | null;
  authoredAt: string | null;
}

export interface GithubIssue {
  id: number;
  integrationId: number;
  githubIssueNumber: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  authorLogin: string | null;
  githubUrl: string | null;
  labels: string[];
  linkedTaskId: number | null;
  githubCreatedAt: string | null;
  githubUpdatedAt: string | null;
}

export interface GithubStats {
  linkedRepositories: number;
  totalPullRequests: number;
  openPullRequests: number;
  mergedPullRequests: number;
  closedPullRequests: number;
  totalCommits: number;
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
}

export interface LinkRepositoryRequest {
  projectId: number;
  repositoryFullName: string;
}

export interface GithubCollaboratorInviteRequest {
  identifier: string;
  permission?: 'pull' | 'triage' | 'push' | 'maintain';
}

export interface GithubCollaboratorInviteResponse {
  projectId: number;
  integrationId: number;
  repositoryFullName: string;
  githubUsername: string;
  permission: 'pull' | 'triage' | 'push' | 'maintain';
  githubStatus: number;
  status: 'INVITATION_CREATED' | 'COLLABORATOR_UPDATED';
  message: string;
}

export interface CreateIssueRequest {
  integrationId: number;
  title: string;
  body?: string;
  labels?: string[];
}

export interface GithubAutomationRule {
  id: number;
  projectId: number;
  trigger: string;
  action: string;
  enabled: boolean;
  config: Record<string, string>;
}

export interface GithubAutomationLog {
  id: number;
  ruleId: number;
  trigger: string;
  action: string;
  context: string;
  outcome: string;
  message: string;
  executedAt: string;
}

export interface ScheduledReportRequest {
  projectId: number;
  format: 'PDF' | 'EXCEL' | 'BOTH';
  scheduleType: 'ONE_TIME' | 'RECURRING';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  customIntervalDays?: number;
  sendTime: string;
  sendDayOfWeek?: number;
  sendDayOfMonth?: number;
  scheduledDate?: string;
  timezone?: string;
  recipientsTo: string[];
  recipientsCc?: string[];
  recipientsBcc?: string[];
  subject?: string;
  bodyMessage?: string;
  endType?: 'AFTER_N' | 'UNTIL_DATE' | 'MANUAL';
  endAfterCount?: number;
  endDate?: string;
}

export interface ScheduledReportResponse {
  id: number;
  projectId: number;
  format: 'PDF' | 'EXCEL' | 'BOTH';
  scheduleType: 'ONE_TIME' | 'RECURRING';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  customIntervalDays?: number;
  sendTime: string;
  sendDayOfWeek?: number;
  sendDayOfMonth?: number;
  scheduledDate?: string;
  timezone?: string;
  recipientsTo: string[];
  recipientsCc?: string[];
  recipientsBcc?: string[];
  subject?: string;
  bodyMessage?: string;
  endType?: 'AFTER_N' | 'UNTIL_DATE' | 'MANUAL';
  endAfterCount?: number;
  endDate?: string;
  sendCount: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  nextSendAt?: string;
  lastSentAt?: string;
  createdAt: string;
}

export const notificationsApi = {
  list: async (): Promise<NotificationFeedResponse> => {
    const { data } = await api.get('/api/notifications');
    return data;
  },
  markRead: async (id: number | string): Promise<void> => {
    await api.patch(`/api/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await api.patch('/api/notifications/read-all');
  },
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/api/notifications/${id}`);
  },
  getPreferences: async (projectId?: number): Promise<NotificationPreferenceRow[]> => {
    const { data } = await api.get('/api/notification-preferences', {
      params: projectId == null ? undefined : { projectId },
    });
    return data;
  },
  updatePreference: async (payload: UpdateNotificationPreferenceRequest): Promise<NotificationPreferenceRow> => {
    const { data } = await api.put('/api/notification-preferences', payload);
    return data;
  },
};

export const gitHubApi = {
  getAutomationRules: async (projectId: number | string): Promise<GithubAutomationRule[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/automations/github`);
    return data || [];
  },
  getAutomationLogs: async (projectId: number | string): Promise<GithubAutomationLog[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/automations/github/logs`);
    return data || [];
  },
  createAutomationRule: async (projectId: number | string, payload: Record<string, unknown>): Promise<GithubAutomationRule> => {
    const { data } = await api.post(`/api/projects/${projectId}/automations/github`, payload);
    return data;
  },
  deleteAutomationRule: async (projectId: number | string, ruleId: number): Promise<void> => {
    await api.delete(`/api/projects/${projectId}/automations/github/${ruleId}`);
  },
  setAutomationRuleEnabled: async (projectId: number | string, ruleId: number, enabled: boolean): Promise<GithubAutomationRule> => {
    const { data } = await api.patch(`/api/projects/${projectId}/automations/github/${ruleId}/enabled`, null, {
      params: { enabled },
    });
    return data;
  },
  linkRepository: async (payload: LinkRepositoryRequest): Promise<GithubRepository> => {
    const { data } = await api.post('/api/github/link', payload);
    return data;
  },
  unlinkRepository: async (integrationId: number, projectId: number): Promise<void> => {
    await api.delete(`/api/github/link/${integrationId}`, { params: { projectId } });
  },
  getLinkedRepositories: async (projectId: number): Promise<GithubRepository[]> => {
    const { data } = await api.get(`/api/github/project/${projectId}/repos`);
    return data;
  },
  inviteCollaborator: async (
    projectId: number,
    payload: GithubCollaboratorInviteRequest,
  ): Promise<GithubCollaboratorInviteResponse> => {
    const { data } = await api.post(`/api/github/project/${projectId}/collaborators`, payload);
    return data;
  },
  getPullRequests: async (projectId: number, options: { state?: string; page?: number; size?: number } = {}): Promise<PageResponse<GithubPr>> => {
    const { state = 'all', page = 0, size = 20 } = options;
    const { data } = await api.get(`/api/github/project/${projectId}/pull-requests`, {
      params: { state, page, size },
    });
    return data;
  },
  linkTaskToPr: async (projectId: number, prId: number, taskId: number): Promise<void> => {
    await api.post(`/api/github/project/${projectId}/pull-requests/${prId}/link-task`, { taskId });
  },
  getCommits: async (projectId: number, options: { page?: number; size?: number } = {}): Promise<PageResponse<GithubCommit>> => {
    const { page = 0, size = 20 } = options;
    const { data } = await api.get(`/api/github/project/${projectId}/commits`, {
      params: { page, size },
    });
    return data;
  },
  getIssues: async (projectId: number, options: { state?: string; page?: number; size?: number } = {}): Promise<PageResponse<GithubIssue>> => {
    const { state = 'open', page = 0, size = 20 } = options;
    const { data } = await api.get(`/api/github/project/${projectId}/issues`, {
      params: { state, page, size },
    });
    return data;
  },
  createIssue: async (projectId: number, payload: CreateIssueRequest): Promise<GithubIssue> => {
    const { data } = await api.post(`/api/github/project/${projectId}/issues`, payload);
    return data;
  },
  getStats: async (projectId: number): Promise<GithubStats> => {
    const { data } = await api.get(`/api/github/project/${projectId}/stats`);
    return data;
  },
  syncProject: async (projectId: number): Promise<void> => {
    await api.post(`/api/github/project/${projectId}/sync`);
  },
  fetchRepositories: async (): Promise<unknown[]> => {
    const { data } = await api.get('/api/github/repositories');
    return data;
  },
};

export const reportsApi = {
  createScheduled: async (payload: ScheduledReportRequest): Promise<ScheduledReportResponse> => {
    const { data } = await api.post('/api/scheduled-reports', payload);
    return data;
  },
  listScheduled: async (projectId: number): Promise<ScheduledReportResponse[]> => {
    const { data } = await api.get(`/api/scheduled-reports/project/${projectId}`);
    return data;
  },
  deleteScheduled: async (id: number): Promise<void> => {
    await api.delete(`/api/scheduled-reports/${id}`);
  },
  pauseScheduled: async (id: number): Promise<ScheduledReportResponse> => {
    const { data } = await api.patch(`/api/scheduled-reports/${id}/pause`);
    return data;
  },
  resumeScheduled: async (id: number): Promise<ScheduledReportResponse> => {
    const { data } = await api.patch(`/api/scheduled-reports/${id}/resume`);
    return data;
  },
  download: async (projectId: number, format: 'PDF' | 'EXCEL'): Promise<unknown> => {
    return api.get(`/api/projects/${projectId}/reports/download`, {
      params: { format },
      responseType: 'arraybuffer',
    });
  },
};
