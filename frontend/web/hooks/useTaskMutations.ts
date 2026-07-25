'use client';

import { useCallback, useMemo } from 'react';
import type { Task } from '@/types';
import { tasksApi, type CreateTaskRequest, type UpdateTaskRequest } from '@/services/tasks-contract';
import { toast } from '@/components/ui';
import {
  applyTaskMutation,
  createMutationId,
  createOptimisticTask,
  isLatestTaskMutation,
  publishTaskMutation,
  revalidateTaskDependents,
  type OptimisticCreateResult,
  type TaskMutationCoordinator,
  type TaskMutationMessage,
} from '@/lib/task-cache';

function message(input: Omit<TaskMutationMessage, 'occurredAt'>): TaskMutationMessage {
  return { ...input, occurredAt: new Date().toISOString() };
}

export function useTaskMutations(projectId: string | number | null): TaskMutationCoordinator {
  const pid = Number(projectId);

  const create = useCallback((payload: CreateTaskRequest, request = tasksApi.create): OptimisticCreateResult => {
    const mutationId = createMutationId();
    const correlatedPayload = {
      ...payload,
      projectId: Number(payload.projectId ?? pid),
      clientMutationId: mutationId,
    };
    const optimisticTask = createOptimisticTask(correlatedPayload, mutationId);
    const optimisticMessage = message({
      operation: 'created', projectId: optimisticTask.projectId!, taskId: optimisticTask.id,
      mutationId, source: 'optimistic', task: optimisticTask,
    });
    applyTaskMutation(optimisticMessage);

    const completion = request(correlatedPayload).then((serverTask) => {
      const committed = message({
        operation: 'created', projectId: optimisticTask.projectId!, taskId: serverTask.id,
        replacesTaskId: optimisticTask.id, mutationId, source: 'http',
        task: { ...serverTask, projectId: serverTask.projectId ?? optimisticTask.projectId, clientMutationId: mutationId, syncState: 'synced' },
      });
      applyTaskMutation(committed);
      publishTaskMutation(committed);
      void revalidateTaskDependents(optimisticTask.projectId!);
      return serverTask;
    }).catch((error) => {
      const rollback = message({
        operation: 'deleted', projectId: optimisticTask.projectId!, taskId: optimisticTask.id,
        mutationId, source: 'rollback',
      });
      if (isLatestTaskMutation(optimisticTask.id, mutationId)) applyTaskMutation(rollback);
      toast('Task could not be created. Your changes were not saved.', 'error');
      throw error;
    });
    // Callers intentionally do not await optimistic creation. Mark the rejection
    // handled while retaining the original promise for callers that need it.
    void completion.catch(() => undefined);
    return { optimisticTask, completion };
  }, [pid]);

  const update = useCallback(async (taskId: number, payload: UpdateTaskRequest, current?: Task) => {
    const mutationId = createMutationId();
    const optimistic = message({ operation: 'updated', projectId: pid, taskId, mutationId, source: 'optimistic', patch: payload as Partial<Task> });
    applyTaskMutation(optimistic);
    try {
      const serverTask = await tasksApi.update(taskId, payload);
      const committed = message({ operation: 'updated', projectId: pid, taskId, mutationId, source: 'http', task: serverTask });
      applyTaskMutation(committed);
      publishTaskMutation(committed);
      void revalidateTaskDependents(pid);
      return serverTask;
    } catch (error) {
      if (current && isLatestTaskMutation(taskId, mutationId)) {
        applyTaskMutation(message({ operation: 'updated', projectId: pid, taskId, mutationId, source: 'rollback', task: current }));
      }
      throw error;
    }
  }, [pid]);

  const move = useCallback(async (taskId: number, patch: Partial<Task>, request: () => Promise<Task>, current?: Task) => {
    const mutationId = createMutationId();
    applyTaskMutation(message({ operation: 'moved', projectId: pid, taskId, mutationId, source: 'optimistic', patch }));
    try {
      const serverTask = await request();
      const committed = message({ operation: 'moved', projectId: pid, taskId, mutationId, source: 'http', task: serverTask });
      applyTaskMutation(committed);
      publishTaskMutation(committed);
      void revalidateTaskDependents(pid);
      return serverTask;
    } catch (error) {
      if (current && isLatestTaskMutation(taskId, mutationId)) {
        applyTaskMutation(message({ operation: 'moved', projectId: pid, taskId, mutationId, source: 'rollback', task: current }));
      }
      throw error;
    }
  }, [pid]);

  const archive = useCallback(async (task: Task) => {
    const mutationId = createMutationId();
    applyTaskMutation(message({ operation: 'archived', projectId: pid, taskId: task.id, mutationId, source: 'optimistic', task: { ...task, archived: true } }));
    try {
      const result = await tasksApi.archive(task.id);
      const committed = message({ operation: 'archived', projectId: pid, taskId: task.id, mutationId, source: 'http', task: result });
      applyTaskMutation(committed); publishTaskMutation(committed); void revalidateTaskDependents(pid); return result;
    } catch (error) {
      if (isLatestTaskMutation(task.id, mutationId)) applyTaskMutation(message({ operation: 'restored', projectId: pid, taskId: task.id, mutationId, source: 'rollback', task }));
      throw error;
    }
  }, [pid]);

  const restore = useCallback(async (task: Task) => {
    const mutationId = createMutationId();
    applyTaskMutation(message({ operation: 'restored', projectId: pid, taskId: task.id, mutationId, source: 'optimistic', task: { ...task, archived: false } }));
    try {
      const result = await tasksApi.unarchive(task.id);
      const committed = message({ operation: 'restored', projectId: pid, taskId: task.id, mutationId, source: 'http', task: result });
      applyTaskMutation(committed); publishTaskMutation(committed); void revalidateTaskDependents(pid); return result;
    } catch (error) {
      if (isLatestTaskMutation(task.id, mutationId)) applyTaskMutation(message({ operation: 'archived', projectId: pid, taskId: task.id, mutationId, source: 'rollback', task }));
      throw error;
    }
  }, [pid]);

  const remove = useCallback(async (task: Task) => {
    const mutationId = createMutationId();
    applyTaskMutation(message({ operation: 'deleted', projectId: pid, taskId: task.id, mutationId, source: 'optimistic' }));
    try {
      await tasksApi.delete(task.id);
      const committed = message({ operation: 'deleted', projectId: pid, taskId: task.id, mutationId, source: 'http' });
      publishTaskMutation(committed); void revalidateTaskDependents(pid);
    } catch (error) {
      if (isLatestTaskMutation(task.id, mutationId)) applyTaskMutation(message({ operation: 'restored', projectId: pid, taskId: task.id, mutationId, source: 'rollback', task }));
      throw error;
    }
  }, [pid]);

  return useMemo(() => ({ create, update, move, archive, restore, delete: remove }), [archive, create, move, remove, restore, update]);
}
