import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/axios';

const REPO_PREFIX = 'github_repo_';
const BACKEND_GITHUB_TOKEN_SENTINEL = 'backend-managed';

// ── Backend-managed GitHub connection ─────────────────────────────────────────
export async function getGitHubToken(): Promise<string | null> {
  const data = await fetchGitHubConnectionStatus();
  return data.connected ? BACKEND_GITHUB_TOKEN_SENTINEL : null;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  username?: string;
}

export async function fetchGitHubConnectionStatus(): Promise<GitHubConnectionStatus> {
  const { data } = await api.get<GitHubConnectionStatus>('/api/github/status');
  return data;
}

export async function startMobileGitHubOAuth(
  destination: 'PROFILE' | 'PROJECT',
  projectId?: string,
): Promise<{ authorizationUrl: string; expiresInSeconds: number }> {
  const { data } = await api.post<{ authorizationUrl: string; expiresInSeconds: number }>(
    '/api/github/mobile/oauth/start',
    { destination, ...(projectId ? { projectId: Number(projectId) } : {}) },
  );
  return data;
}

export async function saveGitHubToken(_token: string): Promise<void> {
  // GitHub access tokens are stored by the backend. Kept as a no-op for the screen flow.
}

export async function clearGitHubToken(): Promise<void> {
  await api.post('/api/github/revoke');
}

export async function fetchGitHubOAuthConfig(): Promise<{ configured: boolean; clientId: string; redirectUri: string }> {
  const { data } = await api.get<{ configured: boolean; clientId: string; redirectUri: string }>('/api/github/oauth-config');
  return data;
}

// ── Project repo connection ────────────────────────────────────────────────────
export interface ProjectGitHubConnection {
  integrationId?: number;
  repoFullName: string;
  ownerLogin: string;
  repoName: string;
  defaultBranch: string;
  private: boolean;
  repositoryUrl?: string;
  active?: boolean;
}

export interface BackendProjectGitHubRepository {
  integrationId: number;
  projectId: number;
  repositoryFullName: string;
  repositoryUrl?: string;
  tokenType?: string;
  active: boolean;
}

function connectionFromBackend(repo: BackendProjectGitHubRepository): ProjectGitHubConnection {
  const [ownerLogin = '', repoName = ''] = repo.repositoryFullName.split('/');
  return {
    integrationId: repo.integrationId,
    repoFullName: repo.repositoryFullName,
    ownerLogin,
    repoName,
    defaultBranch: 'main',
    private: false,
    repositoryUrl: repo.repositoryUrl,
    active: repo.active,
  };
}

export async function getProjectGitHubRepo(projectId: string): Promise<ProjectGitHubConnection | null> {
  try {
    const { data } = await api.get<BackendProjectGitHubRepository[]>(`/api/github/project/${projectId}/repos`);
    const active = (data ?? []).find(repo => repo.active) ?? data?.[0];
    if (active) {
      const connection = connectionFromBackend(active);
      await AsyncStorage.setItem(`${REPO_PREFIX}${projectId}`, JSON.stringify(connection));
      return connection;
    }
  } catch {
    // Fall back to the previous local cache for offline or older backend states.
  }

  const json = await AsyncStorage.getItem(`${REPO_PREFIX}${projectId}`);
  return json ? (JSON.parse(json) as ProjectGitHubConnection) : null;
}

export async function setProjectGitHubRepo(projectId: string, repo: GitHubRepository): Promise<void> {
  const { data } = await api.post<BackendProjectGitHubRepository>('/api/github/link', {
    projectId: Number(projectId),
    repositoryFullName: repo.full_name,
    tokenType: 'OAUTH',
  });
  const conn: ProjectGitHubConnection = {
    ...connectionFromBackend(data),
    defaultBranch: repo.default_branch,
    private: repo.private,
  };
  await AsyncStorage.setItem(`${REPO_PREFIX}${projectId}`, JSON.stringify(conn));
}

export async function clearProjectGitHubRepo(projectId: string): Promise<void> {
  try {
    const current = await getProjectGitHubRepo(projectId);
    if (current?.integrationId) {
      await api.delete(`/api/github/link/${current.integrationId}`, { params: { projectId } });
    }
  } catch {
    // Local cleanup should still happen if backend unlink fails.
  }
  await AsyncStorage.removeItem(`${REPO_PREFIX}${projectId}`);
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  draft: boolean;
  updated_at: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  user: { login: string; avatar_url: string };
  labels: { id: number; name: string; color: string }[];
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { id: number; name: string; color: string }[];
  comments: number;
}

interface BackendGitHubIssue {
  id: number;
  number?: number;
  githubIssueNumber?: number;
  title: string;
  state: 'open' | 'closed';
  labels?: { id?: number; name: string; color: string }[];
  comments?: number;
  authorLogin?: string;
  html_url?: string;
  htmlUrl?: string;
  githubUrl?: string;
  updated_at?: string;
  updatedAt?: string;
  githubUpdatedAt?: string;
}

function normalizeIssue(issue: BackendGitHubIssue): GitHubIssue {
  const login = issue.authorLogin || 'github';
  const number = issue.number ?? issue.githubIssueNumber ?? 0;

  return {
    id: issue.id,
    number,
    title: issue.title,
    state: issue.state,
    html_url: issue.html_url || issue.htmlUrl || issue.githubUrl || '',
    updated_at: issue.updated_at || issue.updatedAt || issue.githubUpdatedAt || new Date().toISOString(),
    user: { login, avatar_url: '' },
    labels: (issue.labels || []).map((label, index) => ({
      id: label.id ?? index,
      name: label.name,
      color: label.color,
    })),
    comments: issue.comments ?? 0,
  };
}

// ── Backend GitHub API helpers ───────────────────────────────────────────────
export async function fetchGitHubUser(_token?: string): Promise<GitHubUser> {
  const { data } = await api.get<GitHubUser>('/api/github/user');
  return data;
}

export async function fetchRepositoriesWithToken(_token?: string): Promise<GitHubRepository[]> {
  const { data } = await api.get<GitHubRepository[]>('/api/github/repositories');
  return data;
}

export async function fetchPullRequests(_token: string | undefined, owner: string, repo: string): Promise<GitHubPullRequest[]> {
  const { data } = await api.get<GitHubPullRequest[]>('/api/github/pull-requests', {
    params: { owner, repo },
  });
  return data;
}

export async function fetchCommits(_token: string | undefined, owner: string, repo: string): Promise<GitHubCommit[]> {
  const { data } = await api.get<GitHubCommit[]>('/api/github/commits', {
    params: { owner, repo },
  });
  return data;
}

export async function fetchIssues(repoFullName: string, _token?: string): Promise<GitHubIssue[]> {
  const { data } = await api.get<BackendGitHubIssue[]>('/api/github/issues', {
    params: { repoFullName, state: 'all' },
  });
  return data.map(normalizeIssue);
}

function readPageContent<T>(payload: T[] | { content?: T[] } | { items?: T[] }): T[] {
  if (Array.isArray(payload)) return payload;
  if ('content' in payload) return payload.content ?? [];
  if ('items' in payload) return payload.items ?? [];
  return [];
}

export async function fetchProjectPullRequests(projectId: string, state = 'all'): Promise<GitHubPullRequest[]> {
  const { data } = await api.get<GitHubPullRequest[] | { content?: GitHubPullRequest[] }>(
    `/api/github/project/${projectId}/pull-requests`,
    { params: { state, size: 50 } },
  );
  return readPageContent(data);
}

export async function fetchProjectCommits(projectId: string): Promise<GitHubCommit[]> {
  const { data } = await api.get<GitHubCommit[] | { content?: GitHubCommit[] }>(
    `/api/github/project/${projectId}/commits`,
    { params: { size: 50 } },
  );
  return readPageContent(data);
}

export async function fetchProjectIssues(projectId: string, state = 'all'): Promise<GitHubIssue[]> {
  const { data } = await api.get<GitHubIssue[] | { content?: BackendGitHubIssue[] }>(
    `/api/github/project/${projectId}/issues`,
    { params: { state, size: 50 } },
  );
  return readPageContent(data as BackendGitHubIssue[] | { content?: BackendGitHubIssue[] }).map(normalizeIssue);
}

export async function syncProjectGitHub(projectId: string): Promise<void> {
  await api.post(`/api/github/project/${projectId}/sync`);
}

// ── Token exchange (backend uses root .env client secret) ─────────────────────
export async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<string | null> {
  const { data } = await api.post<{ success?: boolean }>('/api/github/token', { code, redirectUri });
  return data.success ? BACKEND_GITHUB_TOKEN_SENTINEL : null;
}
