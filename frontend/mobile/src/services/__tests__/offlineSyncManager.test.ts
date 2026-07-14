import { offlineSyncManager, SyncEvent } from '../offlineSyncManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api/axios';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

// Mock api
jest.mock('../../api/axios', () => {
  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  };
  return mockAxios;
});

describe('OfflineSyncManager tests', () => {
  let emittedEvents: SyncEvent[] = [];
  let unsubscribe: () => void;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await offlineSyncManager.clearQueue();
    emittedEvents = [];
    unsubscribe = offlineSyncManager.addListener((event) => {
      emittedEvents.push(event);
    });
    offlineSyncManager.setOnlineState(true);
  });

  afterEach(() => {
    if (unsubscribe) unsubscribe();
  });

  test('should queue mutation when offline', async () => {
    offlineSyncManager.setOnlineState(false);

    const mutationPayload = { projectId: 1, title: 'Test Offline Task', status: 'TODO' };
    await offlineSyncManager.addMutation({
      projectId: 1,
      taskId: -99,
      type: 'CREATE_TASK',
      payload: mutationPayload,
    });

    const queue = offlineSyncManager.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('CREATE_TASK');
    expect(queue[0].payload.title).toBe('Test Offline Task');
    expect(queue[0].status).toBe('pending');

    // Connection changed to offline event should be in emittedEvents
    expect(emittedEvents.some((e) => e.type === 'CONNECTION_CHANGED' && !e.isOnline)).toBe(true);
  });

  test('should sync queued mutations when online status returns', async () => {
    offlineSyncManager.setOnlineState(false);

    // Queue creation
    const createPayload = { projectId: 1, title: 'Sync Task', status: 'TODO' };
    await offlineSyncManager.addMutation({
      projectId: 1,
      taskId: -100,
      type: 'CREATE_TASK',
      payload: createPayload,
    });

    // Mock API post response
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { id: 1001, title: 'Sync Task', status: 'TODO', projectId: 1 },
    });

    // Toggle Online
    offlineSyncManager.setOnlineState(true);

    // Wait a brief tick for async sync queue execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(api.post).toHaveBeenCalledWith('/api/tasks', createPayload);
    expect(offlineSyncManager.getQueue()).toHaveLength(0);

    // Verify TASK_CREATED was emitted
    const createdEvent = emittedEvents.find((e) => e.type === 'TASK_CREATED');
    expect(createdEvent).toBeDefined();
    expect((createdEvent as any).tempId).toBe(-100);
    expect((createdEvent as any).task.id).toBe(1001);
  });

  test('should detect status update conflict when server version is newer and different', async () => {
    const originalTask = { id: 102, title: 'Task 102', status: 'TODO', updatedAt: '2026-05-30T10:00:00Z', projectId: 1 };
    
    // Go offline
    offlineSyncManager.setOnlineState(false);

    // Queue update
    await offlineSyncManager.addMutation({
      projectId: 1,
      taskId: 102,
      type: 'UPDATE_STATUS',
      payload: { status: 'IN_PROGRESS' },
      originalTask,
    });

    // Server has newer updatedAt and different status (DONE)
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' },
    });

    // Go online to sync
    offlineSyncManager.setOnlineState(true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Queue item should fail due to conflict
    const queue = offlineSyncManager.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('failed');
    expect(queue[0].error).toContain('Conflict');
    expect(api.patch).not.toHaveBeenCalled();
  });

  test('should resolve conflict by overwriting server status when overwrite is requested', async () => {
    const originalTask = { id: 102, title: 'Task 102', status: 'TODO', updatedAt: '2026-05-30T10:00:00Z', projectId: 1 };
    
    offlineSyncManager.setOnlineState(false);
    const mutationId = await offlineSyncManager.addMutation({
      projectId: 1,
      taskId: 102,
      type: 'UPDATE_STATUS',
      payload: { status: 'IN_PROGRESS' },
      originalTask,
    });

    // Mock conflict detection and then post-overwrite patch
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' }, // Server state
    });

    // Mock resolveConflict API calls: fetches server task to sync original updatedAt, then patches status
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' },
    });
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' },
    });
    (api.patch as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'IN_PROGRESS', updatedAt: '2026-05-30T10:06:00Z' },
    });

    offlineSyncManager.setOnlineState(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should now be failed conflict
    expect(offlineSyncManager.getQueue()[0].status).toBe('failed');

    // Resolve conflict with overwrite
    await offlineSyncManager.resolveConflict(mutationId, 'overwrite');
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Queue should be cleared and PATCH status called
    expect(offlineSyncManager.getQueue()).toHaveLength(0);
    expect(api.patch).toHaveBeenCalledWith('/api/tasks/102/status', { status: 'IN_PROGRESS' });
  });

  test('should resolve conflict by discarding changes and reverting to server task status', async () => {
    const originalTask = { id: 102, title: 'Task 102', status: 'TODO', updatedAt: '2026-05-30T10:00:00Z', projectId: 1 };
    
    offlineSyncManager.setOnlineState(false);
    const mutationId = await offlineSyncManager.addMutation({
      projectId: 1,
      taskId: 102,
      type: 'UPDATE_STATUS',
      payload: { status: 'IN_PROGRESS' },
      originalTask,
    });

    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' },
    });

    offlineSyncManager.setOnlineState(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(offlineSyncManager.getQueue()[0].status).toBe('failed');

    // Mock reverting get
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 102, status: 'DONE', updatedAt: '2026-05-30T10:05:00Z' },
    });

    // Discard conflict
    await offlineSyncManager.resolveConflict(mutationId, 'discard');
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Queue is cleared and TASK_UPDATED emitted with server state
    expect(offlineSyncManager.getQueue()).toHaveLength(0);
    const updatedEvent = emittedEvents.find((e) => e.type === 'TASK_UPDATED');
    expect(updatedEvent).toBeDefined();
    expect((updatedEvent as any).task.status).toBe('DONE');
  });
});
