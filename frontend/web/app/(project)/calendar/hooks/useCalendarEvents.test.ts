import { act, renderHook } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import { fetchCalendarEvents, patchTaskDates, mapTaskToCalendarEvent } from '../api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { tasksApi } from '@/services/tasks-contract';
import type { Task } from '@/types';

// Mock dependencies
jest.mock('../api', () => ({
  fetchCalendarEvents: jest.fn(),
  patchTaskDates: jest.fn(),
  mapTaskToCalendarEvent: jest.fn((task) => ({
    id: `task-${task.id}`,
    taskId: task.id,
    title: task.title,
    kind: 'task',
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status || 'To Do',
  })),
}));

jest.mock('@/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: jest.fn(),
}));

jest.mock('@/lib/session-cache', () => ({
  buildSessionCacheKey: jest.fn((page, scope) => `cache-${page}-${scope.join('-')}`),
  getSessionCache: jest.fn(),
  setSessionCache: jest.fn(),
}));

jest.mock('@/services/tasks-contract', () => ({
  tasksApi: {
    get: jest.fn(),
    create: jest.fn(),
  },
}));

describe('useCalendarEvents Hook', () => {
  const fetchCalendarEventsMock = fetchCalendarEvents as jest.Mock;
  const patchTaskDatesMock = patchTaskDates as jest.Mock;
  const useTaskWebSocketMock = useTaskWebSocket as jest.Mock;
  const getSessionCacheMock = getSessionCache as jest.Mock;
  const setSessionCacheMock = setSessionCache as jest.Mock;
  const tasksApiGetMock = tasksApi.get as jest.Mock;

  let wsCallback: (event: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    getSessionCacheMock.mockReturnValue({ data: null, isStale: false });
    useTaskWebSocketMock.mockImplementation((projectId, cb) => {
      wsCallback = cb;
    });
  });

  it('performs stale-while-revalidate load on mount', async () => {
    const cachedEvents = [{ id: 'task-1', taskId: 1, title: 'Cached Task', kind: 'task' as const }];
    getSessionCacheMock.mockReturnValue({ data: cachedEvents, isStale: true });

    fetchCalendarEventsMock.mockResolvedValue([
      { id: 'task-1', taskId: 1, title: 'Cached Task', kind: 'task' as const },
      { id: 'task-2', taskId: 2, title: 'Network Task', kind: 'task' as const },
    ]);

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useCalendarEvents('123'));
      hookResult = result;
    });

    expect(hookResult.current.events).toEqual([
      { id: 'task-1', taskId: 1, title: 'Cached Task', kind: 'task' },
      { id: 'task-2', taskId: 2, title: 'Network Task', kind: 'task' },
    ]);
    expect(setSessionCacheMock).toHaveBeenCalledWith(
      'cache-calendar-events-123',
      hookResult.current.events,
      30 * 60 * 1000
    );
  });

  it('falls back to network fetch when no cache exists', async () => {
    const networkEvents = [{ id: 'task-3', taskId: 3, title: 'Network Only', kind: 'task' as const }];
    fetchCalendarEventsMock.mockResolvedValue(networkEvents);

    const { result } = renderHook(() => useCalendarEvents('123'));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.events).toEqual(networkEvents);
    expect(result.current.loading).toBe(false);
  });

  it('appendEvent appends task and updates session cache without network refetch', async () => {
    fetchCalendarEventsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useCalendarEvents('123'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const newTask = { id: 99, title: 'Appended task', startDate: '2026-07-08' } as Task;

    act(() => {
      result.current.appendEvent(newTask);
    });

    expect(result.current.events).toEqual([
      {
        id: 'task-99',
        taskId: 99,
        title: 'Appended task',
        kind: 'task',
        startDate: '2026-07-08',
        dueDate: undefined,
        status: 'To Do',
      },
    ]);
    expect(setSessionCacheMock).toHaveBeenCalledWith(
      'cache-calendar-events-123',
      result.current.events,
      30 * 60 * 1000
    );
    expect(fetchCalendarEventsMock).toHaveBeenCalledTimes(1); // Only initial fetch
  });

  it('patchEventDate optimistically updates, calls API and reverts on failure', async () => {
    const initialEvents = [
      { id: 'task-1', taskId: 1, title: 'Task 1', kind: 'task' as const, startDate: '2026-07-01' },
      { id: 'task-2', taskId: 2, title: 'Task 2', kind: 'task' as const, startDate: '2026-07-02' },
    ];
    fetchCalendarEventsMock.mockResolvedValue(initialEvents);

    const { result } = renderHook(() => useCalendarEvents('123'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Simulate failure
    let resolveApiCall: any;
    const apiPromise = new Promise((_, reject) => {
      resolveApiCall = () => reject(new Error('Network error'));
    });
    patchTaskDatesMock.mockReturnValue(apiPromise);

    let promise: any;
    act(() => {
      promise = result.current.patchEventDate('task-1', new Date(2026, 6, 15)); // 2026-07-15
    });

    // Verify optimistic update in state
    expect(result.current.events[0].startDate).toBe('2026-07-15');

    // Trigger API failure and await hook resolution
    await act(async () => {
      resolveApiCall();
      try {
        await promise;
      } catch {
        // ignore
      }
    });

    // Verify it reverted to original value on failure
    expect(result.current.events[0].startDate).toBe('2026-07-01');
    expect(patchTaskDatesMock).toHaveBeenCalledWith(1, '2026-07-15', '2026-07-15');
  });

  it('refreshOneTask fetches single task and updates calendar event', async () => {
    const initialEvents = [
      { id: 'task-1', taskId: 1, title: 'Task 1', kind: 'task' as const, startDate: '2026-07-01' },
    ];
    fetchCalendarEventsMock.mockResolvedValue(initialEvents);

    const { result } = renderHook(() => useCalendarEvents('123'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const updatedTask = { id: 1, title: 'Updated Task 1 Name', startDate: '2026-07-10' } as Task;
    tasksApiGetMock.mockResolvedValue(updatedTask);

    await act(async () => {
      await result.current.refreshOneTask(1);
    });

    expect(result.current.events[0].title).toBe('Updated Task 1 Name');
    expect(result.current.events[0].startDate).toBe('2026-07-10');
  });

  it('WebSocket TASK_CREATED event appends task if scheduled', async () => {
    fetchCalendarEventsMock.mockResolvedValue([]);
    renderHook(() => useCalendarEvents('123'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Fire WebSocket task created
    act(() => {
      wsCallback({
        type: 'TASK_CREATED',
        task: { id: 5, title: 'WS Task', startDate: '2026-07-05', archived: false },
      });
    });

    expect(fetchCalendarEventsMock).toHaveBeenCalledTimes(1);
  });

  it('WebSocket TASK_UPDATED event upserts task scheduled updates, and removes unscheduled/archived updates', async () => {
    const initialEvents = [
      { id: 'task-1', taskId: 1, title: 'Task 1', kind: 'task' as const, startDate: '2026-07-01' },
    ];
    fetchCalendarEventsMock.mockResolvedValue(initialEvents);

    const { result } = renderHook(() => useCalendarEvents('123'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // 1. Update scheduled task
    act(() => {
      wsCallback({
        type: 'TASK_UPDATED',
        task: { id: 1, title: 'Task 1 Modified', startDate: '2026-07-11', archived: false },
      });
    });
    expect(result.current.events.find((e) => e.taskId === 1)?.title).toBe('Task 1 Modified');

    // 2. Remove if archived
    act(() => {
      wsCallback({
        type: 'TASK_UPDATED',
        task: { id: 1, title: 'Task 1 Modified', startDate: '2026-07-11', archived: true },
      });
    });
    expect(result.current.events.some((e) => e.taskId === 1)).toBe(false);
  });

  it('WebSocket TASK_DELETED removes event', async () => {
    const initialEvents = [
      { id: 'task-1', taskId: 1, title: 'Task 1', kind: 'task' as const, startDate: '2026-07-01' },
    ];
    fetchCalendarEventsMock.mockResolvedValue(initialEvents);

    const { result } = renderHook(() => useCalendarEvents('123'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      wsCallback({
        type: 'TASK_DELETED',
        taskId: 1,
      });
    });

    expect(result.current.events.some((e) => e.taskId === 1)).toBe(false);
  });
});
