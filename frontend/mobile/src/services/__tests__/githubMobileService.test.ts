import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/axios';
import {
  fetchGitHubNotifications,
  getProjectGitHubRepo,
  setProjectGitHubRepo,
  validateGitHubBranch,
} from '../githubMobileService';

jest.mock('../../lib/axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn(), patch: jest.fn() }));
jest.mock('../../auth/storage', () => ({ getCurrentUserId: jest.fn().mockResolvedValue(42) }));

const mockedApi = api as jest.Mocked<typeof api>;

describe('githubMobileService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('does not resurrect a cached repository after a successful empty backend response', async () => {
    await AsyncStorage.setItem('github_repo_42:7', JSON.stringify({ repoFullName: 'old/repo' }));
    mockedApi.get.mockResolvedValue({ data: [] } as never);

    await expect(getProjectGitHubRepo('7')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('github_repo_42:7')).resolves.toBeNull();
  });

  it('recovers a link conflict from the authoritative project repository', async () => {
    mockedApi.post.mockRejectedValue({ response: { status: 409 } });
    mockedApi.get.mockResolvedValue({ data: [{ integrationId: 9, projectId: 7, repositoryFullName: 'owner/repo', active: true }] } as never);

    await expect(setProjectGitHubRepo('7', { id: 1, name: 'repo', full_name: 'owner/repo', private: false, default_branch: 'main' })).resolves.toMatchObject({ integrationId: 9 });
    expect(JSON.parse((await AsyncStorage.getItem('github_repo_42:7'))!)).toMatchObject({ integrationId: 9, repoFullName: 'owner/repo' });
  });

  it('returns only notifications linked to the selected repository', async () => {
    mockedApi.get.mockResolvedValue({ data: { notifications: [
      { id: 1, message: 'PR opened', link: 'https://github.com/owner/repo/pull/1', read: false, createdAt: '2026-01-01' },
      { id: 2, message: 'Other', link: 'https://github.com/other/repo/issues/2', read: false, createdAt: '2026-01-01' },
    ] } } as never);

    await expect(fetchGitHubNotifications('owner/repo')).resolves.toEqual([expect.objectContaining({ id: 1 })]);
  });

  it('validates branch names consistently with web', () => {
    expect(validateGitHubBranch('feature/task-12')).toBeNull();
    expect(validateGitHubBranch('bad branch')).toContain('spaces');
    expect(validateGitHubBranch('bad..branch')).toContain('..');
  });
});
