import type { Notification } from '@/services/notifications-service';
import type { TypeTone } from './types';
import { formatDate, formatRelativeTime as formatRelativeInstant } from '@/lib/date-time';

export const TYPE_TONES: Record<string, TypeTone> = {
  CHAT: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
  TASK: { bg: 'bg-cu-primary/10', text: 'text-cu-primary' },
  PAGE: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  PROJECT: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  MENTION: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  INFO: { bg: 'bg-cu-bg-tertiary', text: 'text-cu-text-secondary' },
  GENERAL: { bg: 'bg-cu-bg-tertiary', text: 'text-cu-text-secondary' },
};

export const TASK_LOOKUP_WINDOW = 40;
export const TASK_LOOKUP_BATCH_SIZE = 6;

export function inferNotificationType(notification: Notification): string {
  if (typeof notification.type === 'string' && notification.type.trim().length > 0) {
    return notification.type.trim().toUpperCase();
  }

  const message = String(notification.message || '').toLowerCase();
  const link = String(notification.link || '').toLowerCase();

  if (message.includes('mention')) return 'MENTION';
  if (link.includes('/chat') || message.includes('chat')) return 'CHAT';
  if (message.includes('task') || link.includes('/task')) return 'TASK';
  if (message.includes('page') || link.includes('/pages')) return 'PAGE';
  if (message.includes('project') || link.includes('/project')) return 'PROJECT';

  return 'GENERAL';
}

export function toTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatRelativeTime(iso: string): string {
  const relative = formatRelativeInstant(iso);
  return relative === 'recently' ? (formatDate(iso) || 'Unknown time') : relative;
}

export function hasActionLink(notification: Notification): boolean {
  return typeof notification.link === 'string' && notification.link.trim().length > 0;
}

export function extractTaskIdFromLink(link?: string): number | null {
  if (typeof link !== 'string' || link.trim().length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(link, 'http://localhost');
    const taskIdParam = parsedUrl.searchParams.get('taskId');
    if (taskIdParam) {
      const parsedTaskId = Number(taskIdParam);
      if (Number.isFinite(parsedTaskId) && parsedTaskId > 0) {
        return parsedTaskId;
      }
    }
  } catch {
    // Fall through to regex parsing for non-standard URLs.
  }

  const taskPathMatch = link.match(/\/tasks?\/(\d+)/i);
  if (!taskPathMatch) {
    return null;
  }

  const parsedTaskId = Number(taskPathMatch[1]);
  return Number.isFinite(parsedTaskId) && parsedTaskId > 0 ? parsedTaskId : null;
}
