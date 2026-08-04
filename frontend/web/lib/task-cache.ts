'use client';

import { mutate as mutateSWR } from 'swr';
import type { Task } from '@/types';
import type { CreateTaskRequest, UpdateTaskRequest } from '@/services/tasks-contract';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

export const TASK_CACHE_RETENTION_MS = 30 * 60_000;

export const taskKeys = {
  project: (projectId: string | number, archived = false) => ['tasks', 'project', String(projectId), archived ? 'archived' : 'active'] as const,
  detail: (taskId: string | number) => ['tasks', 'detail', String(taskId)] as const,
  assigned: () => ['tasks', 'assigned'] as const,
  dashboard: (tab: string) => ['tasks', 'dashboard', tab] as const,
  sprint: (sprintId: string | number) => ['tasks', 'sprint', String(sprintId)] as const,
  board: (projectId: string | number) => ['tasks', 'board', String(projectId)] as const,
};

export type TaskMutationOperation = 'created' | 'updated' | 'moved' | 'archived' | 'restored' | 'deleted';
export type TaskMutationSource = 'optimistic' | 'http' | 'websocket' | 'broadcast' | 'rollback';

export interface TaskMutationMessage {
  operation: TaskMutationOperation;
  projectId: number;
  taskId: number;
  mutationId: string;
  source: TaskMutationSource;
  task?: Task;
  patch?: Partial<Task>;
  replacesTaskId?: number;
  occurredAt: string;
}

export type OptimisticCreateResult = {
  optimisticTask: Task;
  completion: Promise<Task>;
};

export type TaskMutationCoordinator = {
  create: (payload: CreateTaskRequest, request?: (payload: CreateTaskRequest) => Promise<Task>) => OptimisticCreateResult;
  update: (taskId: number, payload: UpdateTaskRequest, current?: Task) => Promise<Task>;
  move: (taskId: number, patch: Partial<Task>, request: () => Promise<Task>, current?: Task) => Promise<Task>;
  archive: (task: Task) => Promise<Task>;
  restore: (task: Task) => Promise<Task>;
  delete: (task: Task) => Promise<void>;
};

const mutationVersions = new Map<number, string>();
const channelName = 'planora-task-cache-v1';
const storageEventKey = 'planora:task-cache:broadcast';

export function createMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createOptimisticTask(payload: CreateTaskRequest, mutationId: string): Task {
  const projectId = Number(payload.projectId);
  return {
    id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
    projectId,
    title: payload.title || 'Untitled Task',
    description: payload.description ?? undefined,
    status: payload.status || 'TODO',
    priority: payload.priority || 'MEDIUM',
    storyPoint: payload.storyPoint ?? 0,
    startDate: payload.startDate ?? undefined,
    dueDate: payload.dueDate ?? undefined,
    sprintId: payload.sprintId ?? undefined,
    milestoneId: payload.milestoneId ?? undefined,
    assigneeId: payload.assigneeId ?? undefined,
    assigneeIds: payload.assigneeId != null ? [payload.assigneeId] : undefined,
    labels: [],
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientMutationId: mutationId,
    syncState: 'pending',
  };
}

export function applyTaskMutationToList(tasks: Task[] | undefined, message: TaskMutationMessage, archived: boolean): Task[] {
  const current = Array.isArray(tasks) ? tasks : [];
  const matchingClientMutationId = message.task?.clientMutationId
    ?? (message.operation === 'created' ? message.mutationId : undefined);
  const matches = (task: Task) => task.id === message.taskId
    || task.id === message.replacesTaskId
    || Boolean(
      matchingClientMutationId
      && task.clientMutationId === matchingClientMutationId,
    );
  const existingIndex = current.findIndex(matches);
  const existing = existingIndex >= 0 ? current[existingIndex] : undefined;

  if (message.operation === 'deleted') return current.filter((task) => !matches(task));

  const nextTask = message.task
    ? { ...existing, ...message.task }
    : existing
      ? { ...existing, ...message.patch }
      : undefined;
  if (!nextTask) return current;

  const belongsInCache = archived ? Boolean(nextTask.archived) : !nextTask.archived;
  const reconciled: Task[] = [];
  let inserted = false;
  for (const task of current) {
    if (!matches(task)) {
      reconciled.push(task);
      continue;
    }
    if (belongsInCache && !inserted) {
      reconciled.push(nextTask);
      inserted = true;
    }
  }
  if (belongsInCache && !inserted) reconciled.push(nextTask);
  return reconciled;
}

function persistedKey(projectId: number, archived: boolean): string | null {
  return buildSessionCacheKey('project-tasks-v1', [projectId, archived ? 'archived' : 'active']);
}

function updatePersistedProjectTasks(message: TaskMutationMessage): void {
  for (const archived of [false, true]) {
    const key = persistedKey(message.projectId, archived);
    if (!key) continue;
    const cached = getSessionCache<Task[]>(key, { allowStale: true });
    if (!cached.data && message.operation !== 'created') continue;
    setSessionCache(key, applyTaskMutationToList(cached.data ?? [], message, archived), TASK_CACHE_RETENTION_MS);
  }
}

export function applyTaskMutation(message: TaskMutationMessage): void {
  mutationVersions.set(message.taskId, message.mutationId);
  if (message.replacesTaskId != null) mutationVersions.delete(message.replacesTaskId);

  for (const archived of [false, true]) {
    void mutateSWR(
      taskKeys.project(message.projectId, archived),
      (current: Task[] | undefined) => applyTaskMutationToList(current, message, archived),
      { revalidate: false },
    );
  }

  if (message.operation === 'deleted') {
    void mutateSWR(taskKeys.detail(message.taskId), undefined, { revalidate: false });
  } else if (message.task || message.patch) {
    void mutateSWR(
      taskKeys.detail(message.taskId),
      (current: Task | undefined) => message.task ? { ...current, ...message.task } : current ? { ...current, ...message.patch } : current,
      { revalidate: false },
    );
  }
  updatePersistedProjectTasks(message);
}

export function isLatestTaskMutation(taskId: number, mutationId: string): boolean {
  return mutationVersions.get(taskId) === mutationId;
}

export function publishTaskMutation(message: TaskMutationMessage): void {
  if (typeof window === 'undefined') return;
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(message);
    channel.close();
  } catch {
    try {
      localStorage.setItem(storageEventKey, JSON.stringify(message));
      localStorage.removeItem(storageEventKey);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }

  // Compatibility signal for surfaces that have not migrated to canonical SWR yet.
  window.dispatchEvent(new CustomEvent('planora:task-updated', { detail: message }));
}

export function subscribeToTaskMutations(onMessage: (message: TaskMutationMessage) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<TaskMutationMessage>) => onMessage({ ...event.data, source: 'broadcast' });
  } catch {
    channel = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageEventKey || !event.newValue) return;
    try {
      onMessage({ ...(JSON.parse(event.newValue) as TaskMutationMessage), source: 'broadcast' });
    } catch {
      // Ignore malformed external messages.
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.close();
    window.removeEventListener('storage', onStorage);
  };
}

export async function revalidateTaskDependents(projectId: number): Promise<void> {
  const startedAt = performance.now();
  await Promise.allSettled([
    mutateSWR((key) => typeof key === 'string' && (key.startsWith('dashboard:') || key.startsWith('dashboardTab:'))),
    mutateSWR((key) => Array.isArray(key) && (
      key[0] === 'tasks' && ['assigned', 'dashboard', 'sprint', 'board'].includes(String(key[1]))
    )),
  ]);
  if (process.env.NODE_ENV === 'development') {
    console.debug('[task-cache] revalidated dependents', { projectId, durationMs: Math.round(performance.now() - startedAt) });
  }
}
