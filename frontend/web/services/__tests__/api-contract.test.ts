import {
  apiContract,
  normalizeDate,
  normalizeDateToISO,
  formatLocalDate,
  formatLocalDateTime,
} from '../api-contract';
import api from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('API Contract & Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Normalization Utilities', () => {
    it('normalizeDate parses different inputs correctly', () => {
      // 1. Date instance
      const date = new Date(2023, 9, 27);
      expect(normalizeDate(date)).toEqual(date);

      // 2. ISO String
      const isoStr = '2023-10-27T10:15:30.000Z';
      expect(normalizeDate(isoStr)).toEqual(new Date(isoStr));

      // 3. LocalDate number array [year, month, day]
      // Java month 10 -> JS month 9 (October)
      expect(normalizeDate([2023, 10, 27])).toEqual(new Date(2023, 9, 27, 0, 0, 0, 0));

      // 4. LocalDateTime number array [year, month, day, hour, min, sec, ms]
      expect(normalizeDate([2023, 10, 27, 10, 15, 30, 125])).toEqual(
        new Date(2023, 9, 27, 10, 15, 30, 125)
      );

      // 5. Epoch number
      const timestamp = 1698382530000;
      expect(normalizeDate(timestamp)).toEqual(new Date(timestamp));

      // 6. Invalid / null values
      expect(normalizeDate(null)).toBeNull();
      expect(normalizeDate(undefined)).toBeNull();
      expect(normalizeDate('invalid-date')).toBeNull();
    });

    it('normalizeDateToISO converts inputs to ISO strings', () => {
      const date = new Date(Date.UTC(2023, 9, 27, 10, 15, 30));
      expect(normalizeDateToISO(date)).toBe(date.toISOString());
      expect(normalizeDateToISO(null)).toBeNull();
    });

    it('formatLocalDateTime formats to a local ISO-like timestamp', () => {
      expect(formatLocalDateTime([2023, 10, 27, 10, 15, 30, 125])).toBe('2023-10-27T10:15:30.125');
      expect(formatLocalDateTime(null)).toBeNull();
    });

    it('formatLocalDate formats to YYYY-MM-DD', () => {
      expect(formatLocalDate([2023, 10, 27])).toBe('2023-10-27');
      expect(formatLocalDate(new Date(2023, 9, 27))).toBe('2023-10-27');
      expect(formatLocalDate(null)).toBeNull();
    });
  });

  describe('Auth API Domain', () => {
    it('login calls post with correct arguments', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { accessToken: 'token' } });
      const payload = { username: 'test', password: 'pwd' };
      const res = await apiContract.auth.login(payload);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/auth/login', payload);
      expect(res).toEqual({ accessToken: 'token' });
    });

    it('register calls post with correct arguments', async () => {
      mockedApi.post.mockResolvedValueOnce({});
      const payload = { email: 't@t.com', password: 'pwd' };
      await apiContract.auth.register(payload);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/auth/register', payload);
    });

    it('getCurrentUser fetches active user profile', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { username: 'alice' } });
      const res = await apiContract.auth.getCurrentUser();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/user/me');
      expect(res).toEqual({ username: 'alice' });
    });
  });

  describe('Projects API Domain', () => {
    it('list fetches all projects', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'P1' }] });
      const res = await apiContract.projects.list();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/projects');
      expect(res).toEqual([{ id: 1, name: 'P1' }]);
    });

    it('get fetches specific project details', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { id: 12, name: 'P12' } });
      const res = await apiContract.projects.get(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12');
      expect(res).toEqual({ id: 12, name: 'P12' });
    });

    it('toggleFavorite posts to favorite endpoint', async () => {
      mockedApi.post.mockResolvedValueOnce({});
      await apiContract.projects.toggleFavorite(12);
      expect(mockedApi.post).toHaveBeenCalledWith('/api/projects/12/favorite');
    });
  });

  describe('Tasks API Domain', () => {
    it('listByProject fetches page of tasks', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { content: [{ id: 1, title: 'T1' }] } });
      const res = await apiContract.tasks.listByProject(12, { page: 1 });
      expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/project/12', { params: { page: 1 } });
      expect(res.content).toEqual([{ id: 1, title: 'T1' }]);
    });

    it('create posts a new task', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { id: 100, title: 'New task' } });
      const res = await apiContract.tasks.create({ title: 'New task', projectId: 12 });
      expect(mockedApi.post).toHaveBeenCalledWith('/api/tasks', { title: 'New task', projectId: 12 });
      expect(res).toEqual({ id: 100, title: 'New task' });
    });

    it('archive patches the archive endpoint', async () => {
      mockedApi.patch.mockResolvedValueOnce({ data: { id: 9, archived: true } });
      const res = await apiContract.tasks.archive(9);
      expect(mockedApi.patch).toHaveBeenCalledWith('/api/tasks/9/archive');
      expect(res).toEqual({ id: 9, archived: true });
    });
  });

  describe('Sprints API Domain', () => {
    it('listByProject fetches sprints', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'S1' }] });
      const res = await apiContract.sprints.listByProject(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/sprints/project/12');
      expect(res).toEqual([{ id: 1, name: 'S1' }]);
    });
  });

  describe('Sprintboards API Domain', () => {
    it('get fetches sprint board config', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { id: 5, columns: [] } });
      const res = await apiContract.sprintboards.get(1);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/sprintboards/sprint/1');
      expect(res).toEqual({ id: 5, columns: [] });
    });

    it('getTasksInColumn fetches tasks inside a sprintboard column', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ taskId: 1, title: 'Test Task' }] });
      const res = await apiContract.sprintboards.getTasksInColumn(5, 'TODO');
      expect(mockedApi.get).toHaveBeenCalledWith('/api/sprintboards/5/columns/TODO/tasks');
      expect(res).toEqual([{ taskId: 1, title: 'Test Task' }]);
    });
  });

  describe('Kanban API Domain', () => {
    it('getBoard fetches board with columns', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { columns: [{ id: 1, name: 'TODO' }] } });
      const res = await apiContract.kanban.getBoard(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/kanbans/project/12/board');
      expect(res.columns).toEqual([{ id: 1, name: 'TODO', title: 'TODO' }]);
    });
  });

  describe('Labels API Domain', () => {
    it('create posts a new label', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { id: 3, name: 'Bug' } });
      const res = await apiContract.labels.create({ projectId: 12, name: 'Bug', color: 'red' });
      expect(mockedApi.post).toHaveBeenCalledWith('/api/labels', { projectId: 12, name: 'Bug', color: 'red' });
      expect(res).toEqual({ id: 3, name: 'Bug' });
    });
  });

  describe('Milestones API Domain', () => {
    it('listByProject fetches milestones', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'M1' }] });
      const res = await apiContract.milestones.listByProject(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/milestones');
      expect(res).toEqual([{ id: 1, name: 'M1' }]);
    });
  });

  describe('Documents API Domain', () => {
    it('listByProject fetches document files', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, fileName: 'd1.pdf' }] });
      const res = await apiContract.documents.listByProject(12, true);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/documents', { params: { includeDeleted: true } });
      expect(res).toEqual([{ id: 1, fileName: 'd1.pdf' }]);
    });
  });

  describe('Project Custom Fields', () => {
    it('deleteCustomField calls the custom field delete endpoint', async () => {
      mockedApi.delete.mockResolvedValueOnce({});
      await apiContract.projects.deleteCustomField(12, 44);
      expect(mockedApi.delete).toHaveBeenCalledWith('/api/projects/12/custom-fields/44');
    });
  });

  describe('Task list helpers', () => {
    it('getAssigned fetches assigned tasks', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, title: 'Assigned' }] });
      const res = await apiContract.tasks.getAssigned({ limit: 100 });
      expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/assigned', { params: { limit: 100 } });
      expect(res).toEqual([{ id: 1, title: 'Assigned' }]);
    });

    it('updateDates serializes local date strings and returns response body', async () => {
      const mockTask = { id: 9, title: 'Test Task' };
      mockedApi.patch.mockResolvedValueOnce({ data: mockTask });
      const result = await apiContract.tasks.updateDates(9, { startDate: '2023-10-27', dueDate: '2023-10-28' });
      expect(mockedApi.patch).toHaveBeenCalledWith('/api/tasks/9/dates', {
        startDate: '2023-10-27',
        dueDate: '2023-10-28',
      });
      expect(result).toEqual(mockTask);
    });
  });

  describe('Pages API Domain', () => {
    it('get fetches wiki page content', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { id: 1, title: 'W1', content: 'hello' } });
      const res = await apiContract.pages.get(1);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/pages/1');
      expect(res).toEqual({ id: 1, title: 'W1', content: 'hello' });
    });
  });

  describe('Chat API Domain', () => {
    it('getSummaries fetches project chats summaries', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { rooms: [], directMessages: [] } });
      const res = await apiContract.chat.getSummaries(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/chat/summaries');
      expect(res).toEqual({ rooms: [], directMessages: [] });
    });
  });

  describe('Notifications API Domain', () => {
    it('list fetches inbox notifications feed', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { unreadCount: 5, notifications: [] } });
      const res = await apiContract.notifications.list();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/notifications');
      expect(res).toEqual({ unreadCount: 5, notifications: [] });
    });
  });

  describe('GitHub API Domain', () => {
    it('getLinkedRepositories fetches repository integrations', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ integrationId: 1, repositoryFullName: 'o/r' }] });
      const res = await apiContract.GitHub.getLinkedRepositories(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/github/project/12/repos');
      expect(res).toEqual([{ integrationId: 1, repositoryFullName: 'o/r' }]);
    });
  });

  describe('Reports API Domain', () => {
    it('listScheduled lists report configurations', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, sendTime: '08:00' }] });
      const res = await apiContract.reports.listScheduled(12);
      expect(mockedApi.get).toHaveBeenCalledWith('/api/scheduled-reports/project/12');
      expect(res).toEqual([{ id: 1, sendTime: '08:00' }]);
    });
  });

  describe('Portfolios API Domain', () => {
    it('list fetches user portfolios', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Port1' }] });
      const res = await apiContract.portfolios.list();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/portfolios');
      expect(res).toEqual([{ id: 1, name: 'Port1' }]);
    });
  });
});
