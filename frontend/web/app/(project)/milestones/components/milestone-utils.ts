import type { MilestoneResponse, Task } from '@/types';
import { STATUS_CONFIG, type MilestoneStatus } from './milestoneConfig';

export type MilestoneHealth = 'on-track' | 'at-risk' | 'overdue' | 'complete' | 'cancelled';
export type MilestoneDueBucket = 'all' | 'overdue' | 'this-week' | 'later' | 'no-date';
export type MilestoneSort = 'dueDate' | 'progress' | 'taskCount' | 'name' | 'updatedAt';
export type MilestoneView = 'board' | 'timeline' | 'list';

export interface MilestoneFilters {
  search: string;
  status: 'ALL' | MilestoneStatus;
  due: MilestoneDueBucket;
  sort: MilestoneSort;
}

export interface MilestoneViewModel extends MilestoneResponse {
  completedTasks: number;
  linkedTasks: number;
  remainingTasks: number;
  progress: number;
  dueDateValue: number | null;
  daysUntilDue: number | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  hasNoDate: boolean;
  health: MilestoneHealth;
  linkedTaskItems: Task[];
}

export interface MilestoneStats {
  total: number;
  active: number;
  overdue: number;
  dueSoon: number;
  linkedTasks: number;
  completedTasks: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set<MilestoneStatus>(['OPEN', 'IN_PROGRESS']);

export function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function parseDateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value.substring(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function groupTasksByMilestone(tasks: Task[]) {
  return tasks.reduce<Record<number, Task[]>>((acc, task) => {
    if (task.milestoneId == null) return acc;
    if (!acc[task.milestoneId]) acc[task.milestoneId] = [];
    acc[task.milestoneId].push(task);
    return acc;
  }, {});
}

function isTaskDone(task: Task) {
  return String(task.status ?? '').toUpperCase() === 'DONE';
}

export function getMilestoneProgress(milestone: MilestoneResponse, linkedTasks: Task[]) {
  const taskCount = linkedTasks.length || milestone.taskCount || 0;
  const completedCount = linkedTasks.length
    ? linkedTasks.filter(isTaskDone).length
    : milestone.completedTaskCount || 0;
  const progress = taskCount > 0
    ? Math.round((completedCount / taskCount) * 100)
    : milestone.progressPercent || 0;

  return {
    linkedTasks: taskCount,
    completedTasks: completedCount,
    remainingTasks: Math.max(0, taskCount - completedCount),
    progress: Math.max(0, Math.min(100, progress)),
  };
}

export function getMilestoneHealth(
  milestone: Pick<MilestoneResponse, 'status' | 'dueDate'>,
  progress: number,
  today = startOfLocalDay(new Date()),
): MilestoneHealth {
  if (milestone.status === 'COMPLETED') return 'complete';
  if (milestone.status === 'CANCELLED') return 'cancelled';

  const dueDate = parseDateValue(milestone.dueDate);
  if (!dueDate) return progress >= 75 ? 'on-track' : 'at-risk';

  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / DAY_MS);
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7 && progress < 80) return 'at-risk';
  return 'on-track';
}

export function buildMilestoneViewModels(
  milestones: MilestoneResponse[],
  tasks: Task[],
  today = startOfLocalDay(new Date()),
): MilestoneViewModel[] {
  const groupedTasks = groupTasksByMilestone(tasks);

  return milestones.map((milestone) => {
    const linkedTaskItems = groupedTasks[milestone.id] ?? [];
    const progressMeta = getMilestoneProgress(milestone, linkedTaskItems);
    const dueDate = parseDateValue(milestone.dueDate);
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / DAY_MS) : null;
    const isActive = ACTIVE_STATUSES.has(milestone.status);
    const health = getMilestoneHealth(milestone, progressMeta.progress, today);

    return {
      ...milestone,
      ...progressMeta,
      dueDateValue: dueDate?.getTime() ?? null,
      daysUntilDue,
      isOverdue: Boolean(isActive && daysUntilDue != null && daysUntilDue < 0),
      isDueSoon: Boolean(isActive && daysUntilDue != null && daysUntilDue >= 0 && daysUntilDue <= 7),
      hasNoDate: !dueDate,
      health,
      linkedTaskItems,
    };
  });
}

export function filterMilestones(items: MilestoneViewModel[], filters: MilestoneFilters) {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (query) {
      const haystack = `${item.name} ${item.description ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.status !== 'ALL' && item.status !== filters.status) return false;
    if (filters.due === 'overdue' && !item.isOverdue) return false;
    if (filters.due === 'this-week' && !item.isDueSoon) return false;
    if (filters.due === 'later' && (item.hasNoDate || item.isOverdue || item.isDueSoon)) return false;
    if (filters.due === 'no-date' && !item.hasNoDate) return false;
    return true;
  });
}

export function sortMilestones(items: MilestoneViewModel[], sort: MilestoneSort) {
  const next = [...items];
  next.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'progress') return b.progress - a.progress || a.name.localeCompare(b.name);
    if (sort === 'taskCount') return b.linkedTasks - a.linkedTasks || a.name.localeCompare(b.name);
    if (sort === 'updatedAt') return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();

    const aDate = a.dueDateValue ?? Number.POSITIVE_INFINITY;
    const bDate = b.dueDateValue ?? Number.POSITIVE_INFINITY;
    return aDate - bDate || a.name.localeCompare(b.name);
  });
  return next;
}

export function getMilestoneStats(items: MilestoneViewModel[]): MilestoneStats {
  return items.reduce<MilestoneStats>((stats, item) => ({
    total: stats.total + 1,
    active: stats.active + (ACTIVE_STATUSES.has(item.status) ? 1 : 0),
    overdue: stats.overdue + (item.isOverdue ? 1 : 0),
    dueSoon: stats.dueSoon + (item.isDueSoon ? 1 : 0),
    linkedTasks: stats.linkedTasks + item.linkedTasks,
    completedTasks: stats.completedTasks + item.completedTasks,
  }), {
    total: 0,
    active: 0,
    overdue: 0,
    dueSoon: 0,
    linkedTasks: 0,
    completedTasks: 0,
  });
}

export function formatDueLabel(item: MilestoneViewModel) {
  if (!item.dueDate) return 'No due date';
  if (item.daysUntilDue == null) return item.dueDate;
  if (item.daysUntilDue < 0) return `${Math.abs(item.daysUntilDue)}d overdue`;
  if (item.daysUntilDue === 0) return 'Due today';
  if (item.daysUntilDue === 1) return 'Due tomorrow';
  return `Due in ${item.daysUntilDue}d`;
}

export function getHealthLabel(health: MilestoneHealth) {
  const labels: Record<MilestoneHealth, string> = {
    'on-track': 'On track',
    'at-risk': 'At risk',
    overdue: 'Overdue',
    complete: 'Complete',
    cancelled: 'Cancelled',
  };
  return labels[health];
}

export function getStatusLabel(status: MilestoneStatus) {
  return STATUS_CONFIG[status]?.label ?? status.replace('_', ' ');
}
