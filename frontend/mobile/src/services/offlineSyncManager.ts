import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { taskService } from './task-service';

export interface QueuedMutation {
  id: string;
  taskId?: number | null; // null for CREATE
  projectId?: number;
  type: 'CREATE_TASK' | 'UPDATE_STATUS' | 'UPDATE_ASSIGNEE' | 'UPDATE_DUE_DATE';
  payload: any;
  originalTask?: any; // Task state at the time of queuing
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  timestamp: number;
}

export type SyncEvent =
  | { type: 'QUEUE_CHANGED'; queue: QueuedMutation[] }
  | { type: 'CONNECTION_CHANGED'; isOnline: boolean }
  | { type: 'TASK_CREATED'; tempId: number; task: any }
  | { type: 'TASK_UPDATED'; task: any }
  | { type: 'TASK_SYNC_FAILED'; taskId: number; error: string; queueItem: QueuedMutation }
  | { type: 'SYNC_COMPLETED' };

type Listener = (event: SyncEvent) => void;

const QUEUE_KEY = 'offline_mutations_queue';
let queue: QueuedMutation[] = [];
let isOnline = true;
const listeners: Set<Listener> = new Set();
let isSyncing = false;
let pingInterval: any = null;

// Initialize
async function init() {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    if (data) {
      queue = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load offline queue from AsyncStorage', e);
  }
}

// Save queue to AsyncStorage
async function saveQueue() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    emit({ type: 'QUEUE_CHANGED', queue: [...queue] });
  } catch (e) {
    console.error('Failed to save offline queue', e);
  }
}

function emit(event: SyncEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('Error in offlineSyncManager listener callback', err);
    }
  });
}

// Periodically ping to check if network has returned
function startPing() {
  if (pingInterval) return;
  pingInterval = setInterval(async () => {
    if (isOnline) {
      stopPing();
      return;
    }
    try {
      // Lightweight request to verify connectivity and auth
      await api.get('/api/tasks/assigned?limit=1', { timeout: 5000 });
      setOnline(true);
    } catch (err: any) {
      // If we get a response (even a 401/403/404), the server is reachable
      if (err.response) {
        setOnline(true);
      }
    }
  }, 10000);
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function setOnline(online: boolean) {
  if (isOnline === online) return;
  isOnline = online;
  emit({ type: 'CONNECTION_CHANGED', isOnline });
  if (online) {
    stopPing();
    void syncQueue();
  } else {
    startPing();
  }
}

// Axios Interceptor for network failures
api.interceptors.response.use(
  (response) => {
    setOnline(true);
    return response;
  },
  (error) => {
    // If request fails and there is no response, it is a network error
    if (!error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      setOnline(false);
    }
    return Promise.reject(error);
  }
);

// Start the queue sync
async function syncQueue() {
  if (isSyncing) return;
  if (!isOnline) return;

  const pendingItem = queue.find((item) => item.status === 'pending');
  if (!pendingItem) {
    if (queue.some((item) => item.status === 'failed')) {
      // Some items failed (e.g. conflicts). Do not emit completion until queue is clear
      return;
    }
    emit({ type: 'SYNC_COMPLETED' });
    return;
  }

  isSyncing = true;
  pendingItem.status = 'syncing';
  await saveQueue();

  try {
    if (pendingItem.type === 'CREATE_TASK') {
      const createdTask = await taskService.create(pendingItem.payload);

      // Replace temporary ID references in other queue items
      const tempId = pendingItem.taskId;
      if (tempId) {
        queue.forEach((item) => {
          if (item.taskId === tempId) {
            item.taskId = createdTask.id;
          }
        });
      }

      // Remove current item from queue
      queue = queue.filter((item) => item.id !== pendingItem.id);
      await saveQueue();

      emit({ type: 'TASK_CREATED', tempId: tempId ?? 0, task: createdTask });
    } else {
      // Update mutations: UPDATE_STATUS, UPDATE_ASSIGNEE, UPDATE_DUE_DATE
      const taskId = pendingItem.taskId;
      if (!taskId) {
        throw new Error('TaskId is required for update mutations');
      }

      // Fetch latest state to check for conflicts
      let serverTask;
      try {
        serverTask = await taskService.get(taskId);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Task deleted on server -> sync failed due to deletion conflict
          pendingItem.status = 'failed';
          pendingItem.error = 'Task has been deleted on the server';
          await saveQueue();
          emit({ type: 'TASK_SYNC_FAILED', taskId, error: pendingItem.error, queueItem: pendingItem });
          isSyncing = false;
          // Continue with next
          void syncQueue();
          return;
        }
        throw err; // Network or server error, bubble up
      }

      // Conflict Check: Compare client original task updatedAt with server task updatedAt
      const serverUpdatedAt = serverTask.updatedAt;
      const originalUpdatedAt = pendingItem.originalTask?.updatedAt;

      let isConflict = false;
      if (originalUpdatedAt && serverUpdatedAt && serverUpdatedAt !== originalUpdatedAt) {
        // Detect if the specific field we want to update has changed on the server
        if (pendingItem.type === 'UPDATE_STATUS') {
          isConflict = serverTask.status !== pendingItem.originalTask.status && serverTask.status !== pendingItem.payload.status;
        } else if (pendingItem.type === 'UPDATE_ASSIGNEE') {
          isConflict = serverTask.assigneeId !== pendingItem.originalTask.assigneeId && serverTask.assigneeId !== pendingItem.payload.assigneeId;
        } else if (pendingItem.type === 'UPDATE_DUE_DATE') {
          const serverDue = serverTask.dueDate ? serverTask.dueDate.slice(0, 10) : null;
          const origDue = pendingItem.originalTask.dueDate ? pendingItem.originalTask.dueDate.slice(0, 10) : null;
          const payloadDue = pendingItem.payload.dueDate ? pendingItem.payload.dueDate.slice(0, 10) : null;
          isConflict = serverDue !== origDue && serverDue !== payloadDue;
        }
      }

      if (isConflict) {
        pendingItem.status = 'failed';
        pendingItem.error = 'Conflict: Server state has changed';
        await saveQueue();
        emit({ type: 'TASK_SYNC_FAILED', taskId, error: pendingItem.error, queueItem: pendingItem });
        isSyncing = false;
        // Continue with other items
        void syncQueue();
        return;
      }

      // Perform update request
      let updatedTask;
      if (pendingItem.type === 'UPDATE_STATUS') {
        updatedTask = await taskService.updateStatus(taskId, pendingItem.payload.status);
      } else if (pendingItem.type === 'UPDATE_ASSIGNEE') {
        const { assigneeId } = pendingItem.payload;
        if (assigneeId) {
          await taskService.assignTaskSingle(taskId, assigneeId);
        } else {
          await taskService.unassignTask(taskId);
        }
        // Fetch fresh task representation after assignee change
        updatedTask = await taskService.get(taskId);
      } else if (pendingItem.type === 'UPDATE_DUE_DATE') {
        await taskService.updateDates(taskId, pendingItem.payload);
        updatedTask = await taskService.get(taskId);
      }

      // Remove from queue
      queue = queue.filter((item) => item.id !== pendingItem.id);
      await saveQueue();

      emit({ type: 'TASK_UPDATED', task: updatedTask });
    }
  } catch (err: any) {
    console.error('Queue sync failed for item:', pendingItem, err);
    // Revert status to pending or leave as failed if validation/server error
    if (!err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      pendingItem.status = 'pending';
      setOnline(false);
    } else {
      pendingItem.status = 'failed';
      pendingItem.error = err.response?.data?.message || 'Server error';
      if (pendingItem.taskId) {
        emit({ type: 'TASK_SYNC_FAILED', taskId: pendingItem.taskId, error: pendingItem.error!, queueItem: pendingItem });
      }
    }
    await saveQueue();
  } finally {
    isSyncing = false;
    // Process next item
    if (isOnline) {
      void syncQueue();
    }
  }
}

export const offlineSyncManager = {
  async init() {
    await init();
  },

  getOnlineStatus() {
    return isOnline;
  },

  setOnlineState(online: boolean) {
    setOnline(online);
  },

  getQueue() {
    return [...queue];
  },

  addListener(listener: Listener) {
    listeners.add(listener);
    // Trigger initial queue update for listener
    listener({ type: 'QUEUE_CHANGED', queue: [...queue] });
    listener({ type: 'CONNECTION_CHANGED', isOnline });
    return () => {
      listeners.delete(listener);
    };
  },

  async addMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'status'>) {
    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const correlatedMutation = mutation.type === 'CREATE_TASK'
      ? {
          ...mutation,
          payload: {
            ...mutation.payload,
            clientMutationId: mutation.payload?.clientMutationId ?? id,
          },
        }
      : mutation;
    const newItem: QueuedMutation = {
      ...correlatedMutation,
      id,
      status: 'pending',
      timestamp: Date.now(),
    };

    queue.push(newItem);
    await saveQueue();

    if (isOnline) {
      void syncQueue();
    }
    return id;
  },

  async resolveConflict(mutationId: string, action: 'overwrite' | 'discard') {
    const item = queue.find((m) => m.id === mutationId);
    if (!item) return;

    if (action === 'overwrite') {
      try {
        // Fetch current server state of task
        if (item.taskId) {
          const serverTask = await taskService.get(item.taskId);
          // Set original task's updatedAt to match server's, bypassing conflict check
          if (item.originalTask) {
            item.originalTask.updatedAt = serverTask.updatedAt;
          }
        }
      } catch (e) {
        console.error('Failed to resolve conflict with overwrite', e);
      }
      item.status = 'pending';
      item.error = undefined;
      await saveQueue();
      if (isOnline) {
        void syncQueue();
      }
    } else {
      // Discard changes: remove mutation and notify listeners to refresh task
      queue = queue.filter((m) => m.id !== mutationId);
      await saveQueue();
      if (item.taskId) {
        try {
          const serverTask = await taskService.get(item.taskId);
          emit({ type: 'TASK_UPDATED', task: serverTask });
        } catch {
          // If task couldn't be fetched (deleted), keep original UI revert
          emit({ type: 'TASK_UPDATED', task: { id: item.taskId, _deleted: true } });
        }
      }
    }
  },

  async clearQueue() {
    queue = [];
    await saveQueue();
  },
};
