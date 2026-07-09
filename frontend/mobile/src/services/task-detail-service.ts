import api from '../api/axios';
import { taskService, type UpdateTaskRequest } from './task-service';

export interface TaskComment {
  id: number;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  authorName?: string;
  user?: {
    userId?: number;
    username?: string;
    fullName?: string;
    profilePicUrl?: string | null;
  };
}

export interface TaskActivity {
  id: number;
  type?: string;
  message?: string;
  createdAt?: string;
  actorName?: string;
  user?: {
    username?: string;
    fullName?: string;
  };
}

export interface TaskAttachment {
  id: number;
  fileName?: string;
  name?: string;
  contentType?: string;
  size?: number;
  fileSize?: number;
  downloadUrl?: string;
  createdAt?: string;
}

export interface TaskCustomFieldValue {
  fieldId?: number;
  customFieldId?: number;
  name?: string;
  fieldName?: string;
  fieldType?: string;
  value?: string | number | null;
}

export interface TaskDetailBundle {
  task: any;
  comments: TaskComment[];
  activities: TaskActivity[];
  attachments: TaskAttachment[];
  customFields: TaskCustomFieldValue[];
}

function settleValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export const taskDetailService = {
  getTask: (taskId: number | string): Promise<any> => taskService.get(taskId),

  updateTask: (taskId: number | string, payload: UpdateTaskRequest): Promise<any> =>
    taskService.update(taskId, payload),

  recordAccess: (taskId: number | string): Promise<void> =>
    api.post(`/api/tasks/${taskId}/access`).then(() => undefined),

  getComments: (taskId: number | string): Promise<TaskComment[]> =>
    api.get<TaskComment[]>(`/api/tasks/${taskId}/comments`).then(r => r.data ?? []),

  addComment: (taskId: number | string, content: string): Promise<void> =>
    api.post(`/api/tasks/${taskId}/comments`, { content }).then(() => undefined),

  getActivities: (taskId: number | string): Promise<TaskActivity[]> =>
    api.get<TaskActivity[]>(`/api/tasks/${taskId}/activities`).then(r => r.data ?? []),

  getAttachments: (taskId: number | string): Promise<TaskAttachment[]> =>
    api.get<TaskAttachment[]>(`/api/tasks/${taskId}/attachments`).then(r => r.data ?? []),

  deleteAttachment: (taskId: number | string, attachmentId: number | string): Promise<void> =>
    api.delete(`/api/tasks/${taskId}/attachments/${attachmentId}`).then(() => undefined),

  getCustomFields: (taskId: number | string): Promise<TaskCustomFieldValue[]> =>
    api.get<TaskCustomFieldValue[]>(`/api/tasks/${taskId}/custom-fields`).then(r => r.data ?? []),

  updateCustomFields: (
    taskId: number | string,
    values: { fieldId: number; value: string | number | null }[],
  ): Promise<void> =>
    api.patch(`/api/tasks/${taskId}/custom-fields`, { values }).then(() => undefined),

  createSubtask: (parentId: number | string, title: string): Promise<any> =>
    api.post(`/api/tasks/${parentId}/subtasks`, { title }).then(r => r.data),

  getGitHubLinks: (taskId: number | string): Promise<any> =>
    api.get(`/api/tasks/${taskId}/github`).then(r => r.data),

  getBundle: async (taskId: number | string): Promise<TaskDetailBundle> => {
    const [task, comments, activities, attachments, customFields] = await Promise.allSettled([
      taskService.get(taskId),
      taskDetailService.getComments(taskId),
      taskDetailService.getActivities(taskId),
      taskDetailService.getAttachments(taskId),
      taskDetailService.getCustomFields(taskId),
    ]);

    return {
      task: settleValue(task, null),
      comments: settleValue(comments, []),
      activities: settleValue(activities, []),
      attachments: settleValue(attachments, []),
      customFields: settleValue(customFields, []),
    };
  },
};
