import api from '../../api/axios';
import { taskService } from '../task-service';

jest.mock('../../api/axios', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

describe('taskService payload mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adds one stable correlation id to the create payload', async () => {
    const payload = {
      title: 'Draft test plan',
      projectId: 42,
      description: 'Cover mobile smoke paths',
      priority: 'HIGH' as const,
      status: 'TODO',
      assigneeIds: [7, 8],
      sprintId: null,
      labelIds: [3],
      milestoneId: null,
    };

    (api.post as jest.Mock).mockResolvedValueOnce({ data: { id: 100, ...payload } });

    await expect(taskService.create(payload)).resolves.toMatchObject({ id: 100 });

    expect(api.post).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        ...payload,
        clientMutationId: expect.stringMatching(/^(mobile-|[0-9a-f]{8}-)/),
      }),
    );
  });

  test('maps status and date updates to backend payload shapes', async () => {
    (api.patch as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 100, status: 'DONE' } })
      .mockResolvedValueOnce({ data: undefined });

    await expect(taskService.updateStatus(100, 'DONE')).resolves.toEqual({ id: 100, status: 'DONE' });
    await expect(
      taskService.updateDates(100, {
        startDate: '2026-06-01',
        dueDate: null,
      })
    ).resolves.toBeUndefined();

    expect(api.patch).toHaveBeenNthCalledWith(1, '/api/tasks/100/status', { status: 'DONE' });
    expect(api.patch).toHaveBeenNthCalledWith(2, '/api/tasks/100/dates', {
      startDate: '2026-06-01',
      dueDate: null,
    });
  });
});
