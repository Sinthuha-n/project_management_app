import { tasksApi, sprintboardsApi, sprintsApi, projectsApi } from '@/services/api-contract';
import { Sprintboard, SprintboardFullResponse, Sprintcolumn } from './types';
import type { Sprint, Task } from '@/types';
import type { CreateTaskRequest } from '@/services/tasks-contract';

/**
 * Fetch sprint board for a specific sprint
 * @param sprintId - The sprint ID to fetch board for
 */
export async function fetchSprintboardBySprintId(sprintId: number): Promise<Sprintboard> {
  const sprintboard = await sprintboardsApi.get(sprintId);

  const columnsWithTasks = await Promise.all(
    sprintboard.columns.map(async (col: { columnStatus: string }) => {
      const tasks = await sprintboardsApi.getTasksInColumn(sprintboard.id, col.columnStatus)
        .catch(() => []);

      return {
        ...col,
        tasks
      };
    })
  );

  return {
    ...sprintboard,
    columns: columnsWithTasks as Sprintcolumn[]
  };
}

export async function fetchSprintboardBySprintIdFull(sprintId: number): Promise<SprintboardFullResponse> {
  return await sprintboardsApi.getFull(sprintId);
}

/**
 * Move a task to a different column
 */
export async function moveTaskToColumn(taskId: number, sprintboardId: number, newColumnStatus: string): Promise<void> {
  await sprintboardsApi.moveTask(taskId, {
    sprintboardId,
    newColumnStatus
  });
}

/**
 * Fetch all sprints for a project to find the active one
 */
export async function fetchSprintsByProject(projectId: number): Promise<Sprint[]> {
  return await sprintsApi.listByProject(projectId);
}

/**
 * Complete a sprint — calls the dedicated complete endpoint.
 * moveIncompleteTo: null = move to backlog, number = destination sprint ID
 */
export async function completeSprint(sprintId: number, moveIncompleteTo: number | null = null): Promise<void> {
  await sprintsApi.complete(sprintId, moveIncompleteTo);
}

/**
 * Create a new task within a sprint
 */
export async function createTask(taskData: CreateTaskRequest): Promise<Task> {
  return await tasksApi.create(taskData);
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: number, taskData: Record<string, unknown>): Promise<unknown> {
  return await tasksApi.update(taskId, taskData);
}

/**
 * Add a new column to the sprint board
 */
export async function addColumn(sprintboardId: number, name: string, status: string, color?: string) {
  return await sprintboardsApi.addColumn(sprintboardId, { name, status, color });
}

export async function updateSprintColumn(
  sprintboardId: number,
  columnId: number,
  payload: { name?: string; color?: string | null }
): Promise<unknown> {
  return await sprintboardsApi.updateColumn(sprintboardId, columnId, payload);
}

export async function deleteSprintColumn(sprintboardId: number, columnId: number): Promise<void> {
  await sprintboardsApi.deleteColumn(sprintboardId, columnId);
}

export async function renameSprintTask(taskId: number, title: string): Promise<unknown> {
  return await tasksApi.update(taskId, { title });
}

export async function deleteSprintTask(taskId: number): Promise<void> {
  await tasksApi.delete(taskId);
}

export async function bulkUpdateTaskStatus(taskIds: number[], status: string): Promise<void> {
  await tasksApi.bulkUpdateStatus({ taskIds, status });
}

export async function bulkDeleteTasks(taskIds: number[]): Promise<void> {
  await tasksApi.bulkDelete({ taskIds });
}

export async function reorderSprintColumns(
  sprintboardId: number,
  reorderRequest: Array<{ id: number; position: number }>
): Promise<void> {
  await sprintboardsApi.reorderColumns(sprintboardId, reorderRequest);
}

export async function patchTaskDueDate(taskId: number, dueDate: string | null): Promise<void> {
  await tasksApi.updateDates(taskId, { dueDate });
}

export async function assignTaskSingle(taskId: number, userId: number): Promise<void> {
  await tasksApi.assignTaskSingle(taskId, userId);
}

export async function assignTaskMultiple(taskId: number, assigneeIds: number[]): Promise<void> {
  await tasksApi.assignTaskMultiple(taskId, { assigneeIds });
}

export interface SprintTeamMemberOption {
  id: number;
  userId: number;
  name: string;
  photoUrl?: string | null;
}

export async function fetchTeamMembers(teamId: number): Promise<SprintTeamMemberOption[]> {
  const payload = await projectsApi.getTeamMembers(teamId);
  const raw = payload as unknown as { members?: unknown[]; data?: unknown[]; content?: unknown[] } | unknown[];
  const items: unknown[] = Array.isArray(raw) ? raw : (raw as { members?: unknown[]; data?: unknown[]; content?: unknown[] })?.members ?? (raw as { members?: unknown[]; data?: unknown[]; content?: unknown[] })?.data ?? (raw as { members?: unknown[]; data?: unknown[]; content?: unknown[] })?.content ?? [];
  const results: SprintTeamMemberOption[] = [];
  for (const entry of items) {
    const member = entry as Record<string, unknown> & { user?: Record<string, unknown> };
    const id = Number(member?.id);
    const userId = Number(member?.user?.userId ?? member?.userId);
    const name = (member?.user?.fullName as string)
      || (member?.user?.username as string)
      || (member?.fullName as string)
      || (member?.username as string);
    const photoUrl = (member?.user?.profilePicUrl as string) || null;
    if (!Number.isFinite(id) || !Number.isFinite(userId) || !name) continue;
    results.push({ id, userId, name, photoUrl });
  }
  return results;
}
