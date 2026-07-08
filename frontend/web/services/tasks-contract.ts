import api from '@/lib/axios';
import {
  updateTaskStatus as updateTaskStatusBuilder,
  updateTaskDates as updateTaskDatesBuilder,
} from '@planora/contracts';
import type { PageResponse } from './contract-common';
import type { components } from '@api-contracts/types';
import type {
  Sprint,
  BurndownResponse,
  MilestoneResponse,
  MilestoneRequest,
  Task,
  Subtask,
  Label,
} from '@/types';

type WithNullableTaskFields<T> = Omit<T, 'startDate' | 'dueDate' | 'sprintId' | 'milestoneId' | 'assigneeId' | 'reporterId' | 'recurrenceRule' | 'recurrenceEnd' | 'customInterval' | 'recurrenceLimit'> & {
  startDate?: string | null;
  dueDate?: string | null;
  sprintId?: number | null;
  milestoneId?: number | null;
  assigneeId?: number | null;
  reporterId?: number | null;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  customInterval?: number | null;
  recurrenceLimit?: number | null;
};

type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export interface TaskCommentDto {
  id: number;
  text: string;
  authorName: string;
  createdAt: string;
}

export interface AssignedTaskQueryParams {
  limit?: number;
}

export type TaskSortField = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'status' | 'title' | 'projectTaskNumber';
export type TaskSortDirection = 'asc' | 'desc';

export interface TaskListQueryParams {
  page?: number;
  size?: number;
  sortBy?: TaskSortField;
  sortDir?: TaskSortDirection;
  archived?: boolean;
}

export interface TaskListAllQueryParams {
  status?: string;
  assigneeId?: number;
  priority?: TaskPriorityValue | string;
  sprintId?: number;
  milestoneId?: number;
  archived?: boolean;
}

// ── Strongly-typed request DTOs (mirrors backend patch DTOs) ────────────────

export type UpdateAssigneesRequest = components['schemas']['UpdateAssigneesRequest'];
export type BulkUpdateStatusRequest = components['schemas']['BulkUpdateStatusRequest'];
export type BulkDeleteTasksRequest = components['schemas']['BulkDeleteTasksRequest'];
export type UpdatePriorityRequest = components['schemas']['UpdatePriorityRequest'];

export type TaskPriorityValue = 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const normalizeTaskPriority = (priority?: string): TaskPriorityValue => {
  if (priority === 'LOW' || priority === 'NORMAL' || priority === 'MEDIUM' || priority === 'HIGH' || priority === 'URGENT') {
    return priority;
  }
  if (priority === 'CRITICAL') {
    return 'URGENT';
  }
  return 'MEDIUM';
};

export type UpdateStatusRequest = components['schemas']['UpdateStatusRequest'];
export type PatchTaskDatesRequest = WithNullableTaskFields<components['schemas']['PatchTaskDatesRequest']>;

export type TaskAttachment = RequireKeys<
  components['schemas']['TaskAttachmentResponseDTO'],
  'id' | 'fileName' | 'contentType' | 'fileSize' | 'downloadUrl' | 'uploadedByName' | 'createdAt'
>;
export type UploadInitRequest = components['schemas']['TaskAttachmentUploadInitRequestDTO'];
export type UploadInitResponse = RequireKeys<components['schemas']['TaskAttachmentUploadInitResponseDTO'], 'uploadUrl' | 'objectKey' | 'expiresInSeconds'>;
export type UploadFinalizeRequest = components['schemas']['TaskAttachmentUploadFinalizeRequestDTO'];

export interface Comment {
  id: number;
  content: string;
  authorName: string;
  createdAt: string;
}

export interface KanbanColumnConfig {
  id: number;
  status: string;
  name: string;
  title: string;
  color: string;
  wipLimit: number;
}

export interface KanbanBoardResponse {
  kanbanId: number;
  name: string;
  projectId: number;
  columns: KanbanColumnConfig[];
}

export type SprintboardTask = RequireKeys<
  components['schemas']['SprintboardTaskResponseDTO'],
  'taskId' | 'title' | 'storyPoint' | 'status' | 'priority'
> & {
  label?: { name: string; color?: string };
};

export interface SprintboardColumn {
  id: number;
  columnName: string;
  columnStatus: string;
  position: number;
  tasks: SprintboardTask[];
}

export interface Sprintboard {
  id: number;
  sprintId: number;
  sprintName: string;
  sprintStatus: string;
  createdAt?: string;
  updatedAt?: string;
  columns: SprintboardColumn[];
}

export interface SprintboardFullResponse extends Sprintboard {
  stats: {
    totalTasks: number;
    doneTasks: number;
    totalStoryPoints: number;
    doneStoryPoints: number;
    overdueTasks: number;
    unassignedTasks: number;
  };
}

export type CreateTaskRequest = WithNullableTaskFields<components['schemas']['TaskRequestDTO']>;
export type UpdateTaskRequest = Partial<CreateTaskRequest>;
export type ReorderTasksRequest = Omit<components['schemas']['ReorderTasksRequest'], 'sprintId'> & { sprintId?: number | null };

export interface SprintStartRequest {
  startDate: string;
  endDate: string;
}

export interface SprintVelocityPoint {
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
}

/**
 * Request body for PATCH /api/tasks/kanban/move.
 * Combines a status change with a full column reorder in one atomic call.
 */
export interface KanbanMoveTaskRequest {
  /** Project that owns the task. */
  projectId: number;
  /** Task being dragged. */
  taskId: number;
  /** Destination column status (may equal source status for same-column reorder). */
  status: string;
  /** Ordered task IDs of the entire destination column after the drag. */
  orderedTaskIds: number[];
}

export const tasksApi = {
  listByProject: async (projectId: number | string, params?: TaskListQueryParams): Promise<PageResponse<Task>> => {
    const { data } = await api.get(`/api/tasks/project/${projectId}`, { params });
    return data;
  },
  listAllByProject: async (projectId: number | string, params?: TaskListAllQueryParams): Promise<Task[]> => {
    const { data } = await api.get(`/api/tasks/project/${projectId}/all`, { params });
    return data;
  },
  get: async (taskId: number | string): Promise<Task> => {
    const { data } = await api.get(`/api/tasks/${taskId}`);
    return data;
  },
  create: async (payload: CreateTaskRequest): Promise<Task> => {
    const { data } = await api.post('/api/tasks', payload);
    return data;
  },
  update: async (taskId: number | string, payload: UpdateTaskRequest): Promise<Task> => {
    const { data } = await api.put(`/api/tasks/${taskId}`, payload);
    return data;
  },
  delete: async (taskId: number | string): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}`);
  },
  archive: async (taskId: number | string): Promise<Task> => {
    const { data } = await api.patch(`/api/tasks/${taskId}/archive`);
    return data;
  },
  unarchive: async (taskId: number | string): Promise<Task> => {
    const { data } = await api.patch(`/api/tasks/${taskId}/unarchive`);
    return data;
  },
  getArchived: async (projectId: number | string): Promise<Task[]> => {
    const { data } = await api.get(`/api/tasks/project/${projectId}/archived`);
    return data;
  },
  updateStatus: async (taskId: number | string, status: string): Promise<Task> => {
    const payload: UpdateStatusRequest = { status };
    const { data } = await updateTaskStatusBuilder(api, taskId, payload);
    return data;
  },
  updatePriority: async (taskId: number | string, priority: UpdatePriorityRequest['priority']): Promise<Task> => {
    const payload: UpdatePriorityRequest = { priority };
    const { data } = await api.patch(`/api/tasks/${taskId}/priority`, payload);
    return data;
  },
  updateDates: async (taskId: number | string, payload: PatchTaskDatesRequest): Promise<Task> => {
    const { data } = await updateTaskDatesBuilder(api, taskId, payload);
    return data;
  },
  saveAsTemplate: async (taskId: number | string, payload: { templateName: string }): Promise<void> => {
    await api.post(`/api/tasks/${taskId}/save-as-template`, payload);
  },
  createSubtask: async (taskId: number | string, payload: { title: string; status: string }): Promise<Subtask> => {
    const { data } = await api.post(`/api/tasks/${taskId}/subtasks`, payload);
    return data;
  },
  getComments: async (taskId: number | string): Promise<TaskCommentDto[]> => {
    const { data } = await api.get(`/api/tasks/${taskId}/comments`);
    return data;
  },
  postComment: async (taskId: number | string, payload: { content: string }): Promise<TaskCommentDto> => {
    const { data } = await api.post(`/api/tasks/${taskId}/comments`, payload);
    return data;
  },
  addDependency: async (taskId: number | string, blockerId: number): Promise<void> => {
    await api.post(`/api/tasks/${taskId}/dependencies/${blockerId}`);
  },
  getAttachments: async (taskId: number | string): Promise<TaskAttachment[]> => {
    const { data } = await api.get(`/api/tasks/${taskId}/attachments`);
    return data;
  },
  initAttachmentUpload: async (taskId: number | string, payload: UploadInitRequest): Promise<UploadInitResponse> => {
    const { data } = await api.post(`/api/tasks/${taskId}/attachments/upload/init`, payload);
    return data;
  },
  finalizeAttachmentUpload: async (taskId: number | string, payload: UploadFinalizeRequest): Promise<TaskAttachment> => {
    const { data } = await api.post(`/api/tasks/${taskId}/attachments/upload/finalize`, payload);
    return data;
  },
  uploadAttachmentFallback: async (taskId: number | string, formData: FormData): Promise<TaskAttachment> => {
    const { data } = await api.post(`/api/tasks/${taskId}/attachments/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  deleteAttachment: async (taskId: number | string, attachmentId: number): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/attachments/${attachmentId}`);
  },
  bulkUpdateStatus: async (payload: BulkUpdateStatusRequest): Promise<void> => {
    await api.patch('/api/tasks/bulk/status', payload);
  },
  bulkDelete: async (payload: BulkDeleteTasksRequest): Promise<void> => {
    await api.delete('/api/tasks/bulk', { data: payload });
  },
  reorderTasks: async (payload: ReorderTasksRequest): Promise<void> => {
    await api.patch('/api/tasks/reorder', payload);
  },
  assignTaskSingle: async (taskId: number | string, userId: number): Promise<void> => {
    await api.patch(`/api/tasks/${taskId}/assign/${userId}`);
  },
  assignTaskMultiple: async (taskId: number | string, payload: UpdateAssigneesRequest): Promise<void> => {
    await api.patch(`/api/tasks/${taskId}/assignees`, payload);
  },
  getCalendarEvents: async (projectId: number | string): Promise<Record<string, unknown>[]> => {
    const { data } = await api.get(`/api/calendar/events?projectId=${projectId}`);
    return data;
  },
  getAssigned: async (params?: AssignedTaskQueryParams): Promise<Task[]> => {
    const { data } = await api.get('/api/tasks/assigned', {
      params,
    });
    return data;
  },
  getWorkedOn: async (params?: AssignedTaskQueryParams): Promise<Task[]> => {
    const { data } = await api.get('/api/tasks/worked-on', {
      params,
    });
    return data;
  },
  getRecent: async (params?: AssignedTaskQueryParams): Promise<Task[]> => {
    const { data } = await api.get('/api/tasks/recent', {
      params,
    });
    return data;
  },
  addLabel: async (taskId: number | string, labelId: number | string): Promise<void> => {
    await api.post(`/api/tasks/${taskId}/label/${labelId}`);
  },
  removeLabel: async (taskId: number | string, labelId: number | string): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/label/${labelId}`);
  },
  /**
   * Atomically moves a task to a new kanban column status and rewrites the
   * backlogPosition for all tasks in the destination column.
   * Used by kanban drag-and-drop — a single call persists both the status
   * change and the new visual order.
   */
  moveKanbanTask: async (payload: KanbanMoveTaskRequest): Promise<Task> => {
    const { data } = await api.patch('/api/tasks/kanban/move', payload);
    return data;
  },
};

export const sprintsApi = {
  listByProject: async (projectId: number | string): Promise<Sprint[]> => {
    const { data } = await api.get(`/api/sprints/project/${projectId}`);
    return data;
  },
  create: async (payload: Record<string, unknown>): Promise<Sprint> => {
    const { data } = await api.post('/api/sprints', payload);
    return data;
  },
  update: async (sprintId: number | string, payload: Record<string, unknown>): Promise<Sprint> => {
    const { data } = await api.put(`/api/sprints/${sprintId}`, payload);
    return data;
  },
  delete: async (sprintId: number | string): Promise<void> => {
    await api.delete(`/api/sprints/${sprintId}`);
  },
  complete: async (sprintId: number | string, moveIncompleteTo: number | null = null): Promise<void> => {
    await api.put(`/api/sprints/${sprintId}/complete`, { moveIncompleteTo });
  },
  start: async (sprintId: number | string, payload: SprintStartRequest): Promise<void> => {
    await api.put(`/api/sprints/${sprintId}/start`, payload);
  },
  getBurndown: async (sprintId: number | string, params?: Record<string, unknown> | URLSearchParams): Promise<BurndownResponse> => {
    const { data } = await api.get(`/api/burndown/sprint/${sprintId}`, { params });
    return data;
  },
  getVelocity: async (projectId: number | string): Promise<SprintVelocityPoint[]> => {
    const { data } = await api.get(`/api/burndown/project/${projectId}/velocity`);
    return data;
  },
};

export const sprintboardsApi = {
  get: async (sprintId: number | string): Promise<Sprintboard> => {
    const { data } = await api.get(`/api/sprintboards/sprint/${sprintId}`);
    return {
      ...data,
      columns: data.columns?.map((col: Record<string, unknown>) => ({
        ...col,
        tasks: []
      }))
    };
  },
  getFull: async (sprintId: number | string): Promise<SprintboardFullResponse> => {
    const { data } = await api.get(`/api/sprintboards/sprint/${sprintId}/full`);
    return {
      ...data,
      columns: data.columns?.map((col: Record<string, unknown> & { tasks?: Record<string, unknown>[] }) => ({
        ...col,
        tasks: col.tasks?.map((t: Record<string, unknown> & { labelName?: string; labelColor?: string }) => ({
          ...t,
          label: t.labelName ? { name: t.labelName, color: t.labelColor } : undefined
        })) || []
      }))
    };
  },
  getRecent: async (limit = 20): Promise<unknown> => {
    const { data } = await api.get('/api/sprintboards/user/recent', { params: { limit } });
    return data;
  },
  getTasksInColumn: async (sprintboardId: number | string, columnStatus: string): Promise<SprintboardTask[]> => {
    const { data } = await api.get(`/api/sprintboards/${sprintboardId}/columns/${columnStatus}/tasks`);
    return data.map((t: Record<string, unknown> & { labelName?: string; labelColor?: string }) => ({
      ...t,
      label: t.labelName ? { name: t.labelName, color: t.labelColor } : undefined
    }));
  },
  moveTask: async (taskId: number | string, payload: { sprintboardId: number; newColumnStatus: string }): Promise<void> => {
    await api.put(`/api/sprintboards/tasks/${taskId}/move`, payload);
  },
  addColumn: async (sprintboardId: number | string, payload: { name: string; status: string }): Promise<unknown> => {
    const { data } = await api.post(`/api/sprintboards/${sprintboardId}/columns`, payload);
    return data;
  },
  reorderColumns: async (sprintboardId: number | string, reorderRequest: Array<{ id: number; position: number }>): Promise<void> => {
    await api.patch(`/api/sprintboards/${sprintboardId}/columns/reorder`, reorderRequest);
  },
};

export const kanbanApi = {
  getBoard: async (projectId: number | string): Promise<KanbanBoardResponse> => {
    const { data } = await api.get(`/api/kanbans/project/${projectId}/board`);
    return {
      ...data,
      columns: data.columns?.map((col: Record<string, unknown> & { name?: string; title?: string }) => ({
        ...col,
        name: col.name || col.title || '',
        title: col.title || col.name || '',
      })) || [],
    };
  },
  createColumn: async (payload: { kanbanId: number; name: string; position: number }): Promise<unknown> => {
    const { data } = await api.post('/api/kanban-columns', payload);
    return data;
  },
  deleteColumn: async (columnId: number | string): Promise<void> => {
    await api.delete(`/api/kanban-columns/${columnId}`);
  },
  reorderColumns: async (reorderRequest: Array<{ id: number; position: number }>): Promise<void> => {
    await api.patch('/api/kanban-columns/reorder', reorderRequest);
  },
  renameColumn: async (columnId: number | string, payload: { name: string }): Promise<void> => {
    await api.patch(`/api/kanban-columns/${columnId}/rename`, payload);
  },
  updateColumnSettings: async (columnId: number | string, settings: { color?: string; wipLimit?: number }): Promise<void> => {
    await api.patch(`/api/kanban-columns/${columnId}/settings`, settings);
  },
};

export const labelsApi = {
  listByProject: async (projectId: number | string): Promise<Label[]> => {
    const { data } = await api.get(`/api/labels/project/${projectId}`);
    return data;
  },
  create: async (payload: { projectId: number; name: string; color: string }): Promise<Label> => {
    const { data } = await api.post('/api/labels', payload);
    return data;
  },
  update: async (id: number | string, payload: { name: string; color: string }): Promise<Label> => {
    const { data } = await api.put(`/api/labels/${id}`, payload);
    return data;
  },
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/api/labels/${id}`);
  },
};

export const milestonesApi = {
  listByProject: async (projectId: number | string): Promise<MilestoneResponse[]> => {
    const { data } = await api.get(`/api/projects/${projectId}/milestones`);
    return data;
  },
  get: async (milestoneId: number | string): Promise<MilestoneResponse> => {
    const { data } = await api.get(`/api/milestones/${milestoneId}`);
    return data;
  },
  create: async (projectId: number | string, payload: MilestoneRequest): Promise<MilestoneResponse> => {
    const { data } = await api.post(`/api/projects/${projectId}/milestones`, payload);
    return data;
  },
  update: async (milestoneId: number | string, payload: MilestoneRequest): Promise<MilestoneResponse> => {
    const { data } = await api.put(`/api/milestones/${milestoneId}`, payload);
    return data;
  },
  delete: async (milestoneId: number | string): Promise<void> => {
    await api.delete(`/api/milestones/${milestoneId}`);
  },
  assignTask: async (taskId: number | string, milestoneId: number | null): Promise<void> => {
    await api.patch(`/api/tasks/${taskId}/milestone`, { milestoneId });
  },
};
