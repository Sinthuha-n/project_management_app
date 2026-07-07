import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import React from 'react';
import type { Task } from '@/types';

export const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  TODO:        { label: 'To Do',       badge: 'bg-gray-100 text-gray-600' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700' },
  IN_REVIEW:   { label: 'In Review',   badge: 'bg-amber-50 text-amber-700' },
  DONE:        { label: 'Done',        badge: 'bg-green-50 text-green-700' },
};

export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  URGENT: { color: '#EF4444', icon: ArrowUp,    label: 'Urgent' },
  HIGH:   { color: '#F97316', icon: ArrowUp,    label: 'High'   },
  MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
  LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
};

export const LIST_GRID_CLASS =
  "md:grid items-center gap-3 px-4 py-2.5 " +
  "grid-cols-[24px_72px_minmax(180px,1fr)_120px_120px_96px_40px] " +
  "xl:grid-cols-[24px_78px_minmax(220px,1fr)_150px_140px_130px_120px_96px_40px]";

export type ListGroupBy = 'none' | 'status' | 'priority' | 'assignee';

export type GroupedTasks = Array<{
  key: string;
  label: string;
  items: Task[];
}>;

export const GROUP_OPTIONS: Array<{ value: ListGroupBy; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
];

export function normalizeStatus(status?: string | null) {
  return status || 'TODO';
}

export function formatStatusLabel(status?: string | null) {
  const safeStatus = normalizeStatus(status);
  return STATUS_CONFIG[safeStatus]?.label ?? safeStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPriorityLabel(priority?: string | null) {
  if (!priority) return 'No priority';
  return PRIORITY_CONFIG[priority]?.label ?? priority.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getTaskAssigneeNames(task: Task) {
  if (task.assignees?.length) {
    return task.assignees.map((person) => person.name).filter(Boolean);
  }
  return task.assigneeName && task.assigneeName !== 'Unassigned' ? [task.assigneeName] : [];
}

export function getGroupLabel(task: Task, groupBy: ListGroupBy) {
  if (groupBy === 'status') return formatStatusLabel(task.status);
  if (groupBy === 'priority') return formatPriorityLabel(task.priority || 'LOW');
  if (groupBy === 'assignee') {
    const names = getTaskAssigneeNames(task);
    return names.length > 0 ? names.join(', ') : 'Unassigned';
  }
  return 'All Tasks';
}

export function buildGroupedTasks(tasks: Task[], groupBy: ListGroupBy): GroupedTasks {
  if (groupBy === 'none') return [{ key: 'all', label: 'All Tasks', items: tasks }];

  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const label = getGroupLabel(task, groupBy);
    const group = groups.get(label) ?? [];
    group.push(task);
    groups.set(label, group);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    items,
  }));
}
