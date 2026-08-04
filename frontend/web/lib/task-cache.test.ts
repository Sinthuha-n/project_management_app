import type { Task } from '@/types';
import { applyTaskMutationToList, createOptimisticTask, type TaskMutationMessage } from './task-cache';

const baseMessage = (overrides: Partial<TaskMutationMessage>): TaskMutationMessage => ({
  operation: 'updated',
  projectId: 7,
  taskId: 10,
  mutationId: 'mutation-1',
  source: 'http',
  occurredAt: '2026-07-14T10:30:00Z',
  ...overrides,
});

describe('task cache reducer', () => {
  it('creates a pending task synchronously with a temporary id', () => {
    const task = createOptimisticTask({ projectId: 7, title: 'Immediate task', status: 'TODO' }, 'client-1');
    expect(task.id).toBeLessThan(0);
    expect(task.syncState).toBe('pending');
    expect(task.clientMutationId).toBe('client-1');
  });

  it('replaces an optimistic task with the authoritative server task', () => {
    const optimistic = {
      id: -1,
      projectId: 7,
      title: 'Draft',
      status: 'TODO',
      clientMutationId: 'mutation-1',
      syncState: 'pending',
    } as Task;
    const server = {
      id: 10,
      projectId: 7,
      title: 'Saved',
      status: 'TODO',
      clientMutationId: 'mutation-1',
      syncState: 'synced',
    } as Task;
    const result = applyTaskMutationToList([optimistic], baseMessage({
      operation: 'created', taskId: 10, replacesTaskId: -1, task: server,
    }), false);
    expect(result).toEqual([server]);
  });

  it.each([
    ['websocket then http', ['websocket', 'http']],
    ['http then websocket', ['http', 'websocket']],
    ['duplicate websocket broadcast', ['websocket', 'websocket']],
  ])('reconciles optimistic creation once when %s', (_label, order) => {
    const before = { id: 5, projectId: 7, title: 'Before', status: 'TODO' } as Task;
    const optimistic = {
      id: -1,
      projectId: 7,
      title: 'New task',
      status: 'TODO',
      clientMutationId: 'client-12345678',
      syncState: 'pending',
    } as Task;
    const server = {
      id: 10,
      projectId: 7,
      title: 'New task',
      status: 'TODO',
      clientMutationId: 'client-12345678',
      syncState: 'synced',
    } as Task;
    let tasks = [before, optimistic];

    for (const source of order) {
      tasks = applyTaskMutationToList(tasks, baseMessage({
        operation: 'created',
        taskId: 10,
        replacesTaskId: source === 'http' ? -1 : undefined,
        mutationId: 'client-12345678',
        source: source as 'http' | 'websocket',
        task: server,
      }), false);
    }

    expect(tasks.map((task) => task.id)).toEqual([5, 10]);
  });

  it('keeps simultaneous same-title creations separate by mutation id', () => {
    const first = {
      id: -1,
      projectId: 7,
      title: 'Same title',
      status: 'TODO',
      clientMutationId: 'client-first',
    } as Task;
    const second = {
      id: -2,
      projectId: 7,
      title: 'Same title',
      status: 'TODO',
      clientMutationId: 'client-second',
    } as Task;
    const serverSecond = {
      ...second,
      id: 22,
      syncState: 'synced' as const,
    };

    const result = applyTaskMutationToList([first, second], baseMessage({
      operation: 'created',
      taskId: 22,
      mutationId: 'client-second',
      source: 'websocket',
      task: serverSecond,
    }), false);

    expect(result.map((task) => task.id)).toEqual([-1, 22]);
  });

  it('moves archived tasks between active and archived caches', () => {
    const task = { id: 10, projectId: 7, title: 'Task', status: 'TODO' } as Task;
    const archived = { ...task, archived: true };
    const message = baseMessage({ operation: 'archived', task: archived });
    expect(applyTaskMutationToList([task], message, false)).toEqual([]);
    expect(applyTaskMutationToList([], message, true)).toEqual([archived]);
  });

  it('removes deleted tasks without disturbing siblings', () => {
    const tasks = [
      { id: 10, title: 'Delete', status: 'TODO' },
      { id: 11, title: 'Keep', status: 'TODO' },
    ] as Task[];
    expect(applyTaskMutationToList(tasks, baseMessage({ operation: 'deleted' }), false).map((task) => task.id)).toEqual([11]);
  });
});
