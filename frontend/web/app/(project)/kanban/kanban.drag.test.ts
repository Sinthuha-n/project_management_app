import { moveKanbanTask } from './api';
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

describe('kanban drag-and-drop — moveKanbanTask', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('calls /api/tasks/kanban/move with projectId, taskId, status, and ordered IDs on cross-column drag', async () => {
    const serverTask = { id: 2, title: 'Card B', status: 'IN_PROGRESS', projectId: 10 };
    mockedAxios.patch.mockResolvedValueOnce({ data: serverTask });

    const payload = {
      projectId: 10,
      taskId: 2,
      status: 'IN_PROGRESS',
      orderedTaskIds: [2, 4, 6],
    };

    const result = await moveKanbanTask(payload);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/kanban/move', payload);
    expect(result).toEqual(serverTask);
  });

  it('calls /api/tasks/kanban/move on same-column reorder (status unchanged)', async () => {
    const serverTask = { id: 3, title: 'Card C', status: 'TODO', projectId: 10 };
    mockedAxios.patch.mockResolvedValueOnce({ data: serverTask });

    const payload = {
      projectId: 10,
      taskId: 3,
      status: 'TODO',
      orderedTaskIds: [5, 3, 1], // reordered within the same column
    };

    const result = await moveKanbanTask(payload);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/tasks/kanban/move', payload);
    expect(result).toEqual(serverTask);
  });

  it('sends empty orderedTaskIds for bulk status updates (e.g. complete board)', async () => {
    const serverTask = { id: 7, title: 'Card D', status: 'DONE', projectId: 10 };
    mockedAxios.patch.mockResolvedValueOnce({ data: serverTask });

    const result = await moveKanbanTask({
      projectId: 10,
      taskId: 7,
      status: 'DONE',
      orderedTaskIds: [],
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      '/api/tasks/kanban/move',
      { projectId: 10, taskId: 7, status: 'DONE', orderedTaskIds: [] }
    );
    expect(result).toEqual(serverTask);
  });

  it('throws and logs on API failure', async () => {
    mockedAxios.patch.mockRejectedValueOnce(new Error('Network error'));

    await expect(moveKanbanTask({
      projectId: 10,
      taskId: 2,
      status: 'IN_PROGRESS',
      orderedTaskIds: [2],
    })).rejects.toThrow('Network error');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error moving kanban task:',
      expect.any(Error)
    );
  });
});

describe('kanban drag-and-drop — optimisticUpdateTaskStatusHelper', () => {
  // Re-test the core helper used by the old status-only update path
  // to ensure backward compatibility while the new drag flow is primary.
  const { optimisticUpdateTaskStatusHelper } = jest.requireActual<
    typeof import('./hooks/useKanbanActions')
  >('./hooks/useKanbanActions');

  type TestTask = { id: number; title: string; status: string };

  const makeTasks = (): TestTask[] => [
    { id: 1, title: 'Alpha', status: 'TODO' },
    { id: 2, title: 'Beta', status: 'IN_PROGRESS' },
    { id: 3, title: 'Gamma', status: 'IN_REVIEW' },
  ];

  it('applies optimistic update before the API resolves', async () => {
    let capturedState: TestTask[] | null = null;
    const setTasks = jest.fn().mockImplementation((updater: (prev: TestTask[]) => TestTask[]) => {
      capturedState = updater(makeTasks());
    });
    const updateFn = jest.fn().mockResolvedValueOnce({ id: 1, status: 'DONE' });

    await optimisticUpdateTaskStatusHelper(makeTasks(), setTasks, 1, 'DONE', updateFn);

    expect((capturedState as TestTask[] | null)?.find((t: TestTask) => t.id === 1)?.status).toBe('DONE');
    expect(updateFn).toHaveBeenCalledWith(1, 'DONE', undefined);
  });

  it('reverts state on API failure', async () => {
    const calls: Array<(prev: TestTask[]) => TestTask[]> = [];
    const setTasks = jest.fn().mockImplementation(
      (updater: (prev: TestTask[]) => TestTask[]) => calls.push(updater)
    );
    const updateFn = jest.fn().mockRejectedValueOnce(new Error('Server error'));

    const tasks = makeTasks();
    await expect(
      optimisticUpdateTaskStatusHelper(tasks, setTasks, 2, 'DONE', updateFn)
    ).rejects.toThrow('Server error');

    expect(setTasks).toHaveBeenCalledTimes(2);
    // First call: optimistic
    const optimisticResult = calls[0](tasks);
    expect(optimisticResult.find((t: TestTask) => t.id === 2)?.status).toBe('DONE');
    // Second call: revert
    const revertedResult = calls[1](tasks);
    expect(revertedResult.find((t: TestTask) => t.id === 2)?.status).toBe('IN_PROGRESS');
  });
});
