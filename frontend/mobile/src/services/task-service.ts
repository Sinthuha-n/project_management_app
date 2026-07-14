import api from '../api/axios';
import type { components } from '@api-contracts/types';
import {
  updateTaskStatus as updateTaskStatusBuilder,
  updateTaskDates as updateTaskDatesBuilder,
} from '@planora/contracts';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type WithNullableTaskFields<T> = Omit<T, 'startDate' | 'dueDate' | 'sprintId' | 'milestoneId' | 'assigneeId' | 'priority'> & {
  startDate?: string | null;
  dueDate?: string | null;
  sprintId?: number | null;
  milestoneId?: number | null;
  assigneeId?: number | null;
  priority?: TaskPriority;
};

export type CreateTaskRequest = WithNullableTaskFields<components['schemas']['TaskRequestDTO']>;
export type UpdateTaskRequest = Partial<CreateTaskRequest>;
export type PatchTaskDatesRequest = WithNullableTaskFields<components['schemas']['PatchTaskDatesRequest']>;
export type BulkStatusRequest = components['schemas']['BulkUpdateStatusRequest'];
export type BulkDeleteRequest = components['schemas']['BulkDeleteTasksRequest'];
export type AssigneeRequest = components['schemas']['UpdateAssigneesRequest'];
export type ReorderTasksRequest = Omit<components['schemas']['ReorderTasksRequest'], 'sprintId'> & { sprintId?: number | null };

export type TaskSortField = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'status' | 'title' | 'projectTaskNumber';
export type TaskSortDirection = 'asc' | 'desc';

export interface TaskListQueryParams {
  page?: number;
  size?: number;
  sortBy?: TaskSortField;
  sortDir?: TaskSortDirection;
}

export interface TaskListAllQueryParams {
  status?: string;
  assigneeId?: number;
  priority?: string;
  sprintId?: number;
  milestoneId?: number;
  archived?: boolean;
}

export interface SprintStartRequest {
  startDate: string;
  endDate: string;
}

export interface SprintVelocityPoint {
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
}

export interface RecurrenceUpdatePayload {
  recurrenceActive?: boolean;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  customInterval?: number | null;
  recurrenceLimit?: number | null;
}

export interface RecurringTask {
  id: number;
  title: string;
  recurrenceRule: string | null;
  recurrenceEnd: string | null;
  recurrenceActive: boolean;
  customInterval: number | null;
  recurrenceLimit: number | null;
  recurrenceCount: number;
  nextOccurrence: string | null;
  dueDate?: string | null;
}

export const taskService = {
  listByProject: (projectId: number | string, params?: TaskListQueryParams): Promise<any> =>
    api.get(`/api/tasks/project/${projectId}`, { params }).then(r => r.data),

  listAllByProject: (projectId: number | string, params?: TaskListAllQueryParams): Promise<any[]> =>
    api.get(`/api/tasks/project/${projectId}/all`, { params }).then(r => r.data),

  get: (taskId: number | string): Promise<any> =>
    api.get(`/api/tasks/${taskId}`).then(r => r.data),

  create: (payload: CreateTaskRequest): Promise<any> =>
    api.post('/api/tasks', payload).then(r => r.data),

  update: (taskId: number | string, payload: UpdateTaskRequest): Promise<any> =>
    api.put(`/api/tasks/${taskId}`, payload).then(r => r.data),

  // Update recurrence-specific fields on a task (pause/resume or remove a schedule).
  setRecurrence: (taskId: number | string, payload: RecurrenceUpdatePayload): Promise<any> =>
    api.put(`/api/tasks/${taskId}`, payload).then(r => r.data),

  delete: (taskId: number | string): Promise<void> =>
    api.delete(`/api/tasks/${taskId}`).then(() => undefined),

  archive: (taskId: number | string): Promise<any> =>
    api.patch(`/api/tasks/${taskId}/archive`).then(r => r.data),

  unarchive: (taskId: number | string): Promise<any> =>
    api.patch(`/api/tasks/${taskId}/unarchive`).then(r => r.data),

  getArchived: (projectId: number | string): Promise<any[]> =>
    api.get(`/api/tasks/project/${projectId}/archived`).then(r => r.data),

  updateStatus: (taskId: number | string, status: string): Promise<any> =>
    updateTaskStatusBuilder(api, taskId, { status }).then(r => r.data),

  updateDates: (taskId: number | string, payload: PatchTaskDatesRequest): Promise<void> =>
    updateTaskDatesBuilder(api, taskId, payload).then(() => undefined),

  bulkUpdateStatus: (payload: BulkStatusRequest): Promise<void> =>
    api.patch('/api/tasks/bulk/status', payload).then(() => undefined),

  bulkDelete: (payload: BulkDeleteRequest): Promise<void> =>
    api.delete('/api/tasks/bulk', { data: payload }).then(() => undefined),

  reorderTasks: (payload: ReorderTasksRequest): Promise<void> =>
    api.patch('/api/tasks/reorder', payload).then(() => undefined),

  assignTaskSingle: (taskId: number | string, userId: number): Promise<void> =>
    api.patch(`/api/tasks/${taskId}/assign/${userId}`).then(() => undefined),

  unassignTask: (taskId: number | string): Promise<void> =>
    api.delete(`/api/tasks/${taskId}/assignee`).then(() => undefined),

  assignTaskMultiple: (taskId: number | string, payload: AssigneeRequest): Promise<void> =>
    api.patch(`/api/tasks/${taskId}/assignees`, payload).then(() => undefined),

  getAssigned: (params?: { limit?: number }): Promise<any[]> =>
    api.get('/api/tasks/assigned', { params }).then(r => r.data),

  getWorkedOn: (params?: { limit?: number }): Promise<any[]> =>
    api.get('/api/tasks/worked-on', { params }).then(r => r.data),

  getRecent: (params?: { limit?: number }): Promise<any[]> =>
    api.get('/api/tasks/recent', { params }).then(r => r.data),

  addLabel: (taskId: number | string, labelId: number | string): Promise<void> =>
    api.post(`/api/tasks/${taskId}/label/${labelId}`).then(() => undefined),

  removeLabel: (taskId: number | string, labelId: number | string): Promise<void> =>
    api.delete(`/api/tasks/${taskId}/label/${labelId}`).then(() => undefined),
};

export const sprintService = {
  listByProject: (projectId: number | string): Promise<any[]> =>
    api.get(`/api/sprints/project/${projectId}`).then(r => r.data),

  create: (payload: Record<string, unknown>): Promise<any> =>
    api.post('/api/sprints', payload).then(r => r.data),

  update: (sprintId: number | string, payload: Record<string, unknown>): Promise<any> =>
    api.put(`/api/sprints/${sprintId}`, payload).then(r => r.data),

  delete: (sprintId: number | string): Promise<void> =>
    api.delete(`/api/sprints/${sprintId}`).then(() => undefined),

  complete: (sprintId: number | string, moveIncompleteTo: number | null = null): Promise<void> =>
    api.put(`/api/sprints/${sprintId}/complete`, { moveIncompleteTo }).then(() => undefined),

  start: (sprintId: number | string, payload: SprintStartRequest): Promise<void> =>
    api.put(`/api/sprints/${sprintId}/start`, payload).then(() => undefined),

  getBurndown: (sprintId: number | string, params?: Record<string, unknown>): Promise<any> =>
    api.get(`/api/burndown/sprint/${sprintId}`, { params }).then(r => r.data),

  getVelocity: (projectId: number | string): Promise<SprintVelocityPoint[]> =>
    api.get(`/api/burndown/project/${projectId}/velocity`).then(r => r.data),
};

export const sprintboardService = {
  get: (sprintId: number | string): Promise<any> =>
    api.get(`/api/sprintboards/sprint/${sprintId}`).then(r => r.data),

  getFull: (sprintId: number | string): Promise<any> =>
    api.get(`/api/sprintboards/sprint/${sprintId}/full`).then(r => r.data),

  getRecent: (limit = 20): Promise<any> =>
    api.get('/api/sprintboards/user/recent', { params: { limit } }).then(r => r.data),

  getTasksInColumn: (sprintboardId: number | string, columnStatus: string): Promise<any[]> =>
    api.get(`/api/sprintboards/${sprintboardId}/columns/${columnStatus}/tasks`).then(r => r.data),

  moveTask: (taskId: number | string, payload: { sprintboardId: number; newColumnStatus: string }): Promise<void> =>
    api.put(`/api/sprintboards/tasks/${taskId}/move`, payload).then(() => undefined),

  addColumn: (sprintboardId: number | string, payload: { name: string; status: string }): Promise<any> =>
    api.post(`/api/sprintboards/${sprintboardId}/columns`, payload).then(r => r.data),

  reorderColumns: (sprintboardId: number | string, reorderRequest: { id: number; position: number }[]): Promise<void> =>
    api.patch(`/api/sprintboards/${sprintboardId}/columns/reorder`, reorderRequest).then(() => undefined),

  deleteColumn: (sprintboardId: number | string, columnId: number | string): Promise<void> =>
    api.delete(`/api/sprintboards/${sprintboardId}/columns/${columnId}`).then(() => undefined),
};

export const kanbanService = {
  getBoard: (projectId: number | string): Promise<any> =>
    api.get(`/api/kanbans/project/${projectId}/board`).then(r => r.data),

  createColumn: (payload: { kanbanId: number; name: string; position: number }): Promise<any> =>
    api.post('/api/kanban-columns', payload).then(r => r.data),

  deleteColumn: (columnId: number | string): Promise<void> =>
    api.delete(`/api/kanban-columns/${columnId}`).then(() => undefined),

  reorderColumns: (reorderRequest: { id: number; position: number }[]): Promise<void> =>
    api.patch('/api/kanban-columns/reorder', reorderRequest).then(() => undefined),

  renameColumn: (columnId: number | string, payload: { name: string }): Promise<void> =>
    api.patch(`/api/kanban-columns/${columnId}/rename`, payload).then(() => undefined),

  updateColumnSettings: (columnId: number | string, settings: { color?: string; wipLimit?: number }): Promise<void> =>
    api.patch(`/api/kanban-columns/${columnId}/settings`, settings).then(() => undefined),
};
