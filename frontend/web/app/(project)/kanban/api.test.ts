import {
  archiveTask,
  createTask,
  deleteTask,
  fetchTasksByProject,
  fetchAllTasksByProject,
  getArchivedTasks,
  fetchTeamMembers,
  moveKanbanTask,
  unarchiveTask,
  updateTask,
  updateTaskStatus,
} from './api';
import axios from '@/lib/axios';

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

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('kanban api', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('fetchTasksByProject uses the /all endpoint ordered by backlogPosition', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, title: 'Task 1' }] });

    const result = await fetchTasksByProject(12);

    // Must call /all so the server returns tasks ordered by backlogPosition,
    // not the paginated createdAt-desc endpoint.
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/tasks/project/12/all', { params: {} });
    expect(result).toEqual([{ id: 1, title: 'Task 1' }]);
  });

  it('fetchTasksByProject passes archived filter to the /all endpoint', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, title: 'Active task', archived: false }] });

    const result = await fetchTasksByProject(12, { archived: false });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/tasks/project/12/all', { params: { archived: false } });
    expect(result).toEqual([{ id: 1, title: 'Active task', archived: false }]);
  });

  it('fetches archived tasks and restores them through archive helpers', async () => {
    mockedAxios.patch
      .mockResolvedValueOnce({ data: { id: 2, title: 'Archived task', archived: true } })
      .mockResolvedValueOnce({ data: { id: 2, title: 'Archived task', archived: false } });
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 2, title: 'Archived task', archived: true }] });

    const archived = await archiveTask(2);
    const list = await getArchivedTasks(12);
    const restored = await unarchiveTask(2);

    expect(mockedAxios.patch).toHaveBeenNthCalledWith(1, '/api/tasks/2/archive');
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/tasks/project/12/archived');
    expect(mockedAxios.patch).toHaveBeenNthCalledWith(2, '/api/tasks/2/unarchive');
    expect(archived.archived).toBe(true);
    expect(list).toEqual([{ id: 2, title: 'Archived task', archived: true }]);
    expect(restored.archived).toBe(false);
  });

  it('fetchAllTasksByProject returns task list', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, title: 'Task 1' }] });

    const result = await fetchAllTasksByProject(12);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/tasks/project/12/all', { params: {} });
    expect(result).toEqual([{ id: 1, title: 'Task 1' }]);
  });

  it('createTask validates required fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(createTask({ projectId: 12, status: 'TODO' } as any)).rejects.toThrow('Failed to create task');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(createTask({ title: 'Task', status: 'TODO' } as any)).rejects.toThrow('Failed to create task');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(createTask({ title: 'Task', projectId: 12 } as any)).rejects.toThrow('Failed to create task');
  });

  it('createTask maps backend errors to user friendly message', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 403,
      },
    });

    await expect(
      createTask({ title: 'Build', projectId: 12, status: 'TODO' })
    ).rejects.toThrow('You do not have permission to create tasks in this project.');
  });

  it('createTask keeps assignee optional and sends it only when selected', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 1, title: 'Unassigned task' } })
      .mockResolvedValueOnce({ data: { id: 2, title: 'Assigned task', assigneeId: 7 } });

    await createTask({ title: 'Unassigned task', projectId: 12, status: 'TODO' });
    await createTask({ title: 'Assigned task', projectId: 12, status: 'TODO', assigneeId: 7 });

    expect(mockedAxios.post).toHaveBeenNthCalledWith(1, '/api/tasks', expect.objectContaining({
      title: 'Unassigned task',
      assigneeId: undefined,
    }));
    expect(mockedAxios.post).toHaveBeenNthCalledWith(2, '/api/tasks', expect.objectContaining({
      title: 'Assigned task',
      assigneeId: 7,
    }));
  });

  it('update and delete task call expected endpoints', async () => {
    mockedAxios.patch.mockResolvedValueOnce({ data: { id: 3, status: 'DONE' } });
    mockedAxios.put.mockResolvedValueOnce({ data: { id: 3, title: 'Updated' } });
    mockedAxios.delete.mockResolvedValueOnce({});

    const statusResult = await updateTaskStatus(3, 'DONE');
    const taskResult = await updateTask(3, { title: 'Updated' });
    await deleteTask(3);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/3/status', { status: 'DONE' });
    expect(mockedAxios.put).toHaveBeenCalledWith('/api/tasks/3', { title: 'Updated' });
    expect(mockedAxios.delete).toHaveBeenCalledWith('/api/tasks/3');
    expect(statusResult).toEqual({ id: 3, status: 'DONE' });
    expect(taskResult).toEqual({ id: 3, title: 'Updated' });
  });

  it('updateTaskStatus falls back to PUT on 404 when title is provided', async () => {
    mockedAxios.patch.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.put.mockResolvedValueOnce({ data: { id: 3, status: 'DONE', title: 'Task 3' } });

    const result = await updateTaskStatus(3, 'DONE', 'Task 3');

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/3/status', { status: 'DONE' });
    expect(mockedAxios.put).toHaveBeenCalledWith('/api/tasks/3', { title: 'Task 3', status: 'DONE' });
    expect(result).toEqual({ id: 3, status: 'DONE', title: 'Task 3' });
  });

  it('fetchTeamMembers supports wrapped payload shape', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        members: [{ id: '8', user: { userId: 12, username: 'alice', profilePicUrl: '/api/auth/users/12/photo' } }, { id: 'x', name: '' }],
      },
    });

    const result = await fetchTeamMembers(10);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/teams/10/members');
    expect(result).toEqual([{ id: 12, memberId: 8, userId: 12, name: 'alice', photoUrl: 'http://localhost:8080/api/auth/users/12/photo' }]);
  });

  it('fetchTeamMembers returns every valid project member as an assignee option', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        { id: 1, user: { userId: 101, username: 'alex' } },
        { id: 2, user: { userId: 102, username: 'maya' } },
        { id: 3, user: { userId: 103, fullName: 'Nora Lee' } },
        { id: 4, user: { userId: 104, email: 'sam@example.com' } },
      ],
    });

    const result = await fetchTeamMembers(10);

    expect(result.map(member => member.name)).toEqual(['alex', 'maya', 'Nora Lee', 'sam@example.com']);
    expect(result.map(member => member.id)).toEqual([101, 102, 103, 104]);
  });

  it('moveKanbanTask sends correct payload to /api/tasks/kanban/move', async () => {
    const updatedTask = { id: 5, title: 'Moved', status: 'IN_PROGRESS' };
    mockedAxios.patch.mockResolvedValueOnce({ data: updatedTask });

    const payload = {
      projectId: 1,
      taskId: 5,
      status: 'IN_PROGRESS',
      orderedTaskIds: [5, 3, 7],
    };
    const result = await moveKanbanTask(payload);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/kanban/move', payload);
    expect(result).toEqual(updatedTask);
  });

  it('moveKanbanTask supports same-column reorder (orderedTaskIds only)', async () => {
    const updatedTask = { id: 5, title: 'Reordered', status: 'TODO' };
    mockedAxios.patch.mockResolvedValueOnce({ data: updatedTask });

    const payload = {
      projectId: 1,
      taskId: 5,
      status: 'TODO',
      orderedTaskIds: [3, 5, 7],
    };
    const result = await moveKanbanTask(payload);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/kanban/move', payload);
    expect(result).toEqual(updatedTask);
  });
});
