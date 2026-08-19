import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Task } from '../types';
import type { Milestone } from '../components/TimelineView';

export type TimelineZoom = 'day' | 'week' | 'month';
export type TimelineGroupBy = 'none' | 'status' | 'assignee' | 'milestone';

export interface TimelineFilters {
  search: string;
  assignee: string;
  assignees?: string[];
  milestone: string;
  schedule: '' | 'scheduled' | 'unscheduled';
  focus: '' | 'blocked' | 'overdue' | 'due-week' | 'past-milestone';
  hideWeekends: boolean;
  showDone: boolean;
}

export interface TimelineInsight {
  scheduled: number;
  unscheduled: number;
  overdue: number;
  blocked: number;
  dueThisWeek: number;
  milestoneLinked: number;
  pastMilestone: number;
}

export interface TimelineTaskModel extends Task {
  startDateObj: Date;
  dueDateObj: Date;
  durationDays: number;
  leftPx: number;
  widthPx: number;
  isBlocked: boolean;
  isOverdue: boolean;
  isPastMilestone: boolean;
}

export interface TimelineUnit {
  key: string;
  label: string;
  sublabel?: string;
  startIndex: number;
  span: number;
  isWeekend?: boolean;
}

export const TIMELINE_COLUMN_WIDTH = 320;
export const ZOOM_WIDTHS: Record<TimelineZoom, number> = {
  day: 38,
  week: 22,
  month: 12,
};
export const TIMELINE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_TIMELINE_PAGE_SIZE = 10;

export function safeParseDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsedDateOnly = new Date(year, month - 1, day);
    return isValid(parsedDateOnly) ? startOfDay(parsedDateOnly) : null;
  }
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return startOfDay(parsed);
}

export function isDoneStatus(status?: string | null) {
  const value = (status ?? '').toUpperCase();
  return value === 'DONE' || value === 'COMPLETED' || value === 'CLOSED';
}

export function statusLabel(status?: string | null) {
  return (status || 'TODO').replace(/_/g, ' ');
}

export function taskHasSchedule(task: Task) {
  return Boolean(getTaskSchedule(task));
}

export function getTaskSchedule(task: Task) {
  const due = safeParseDate(task.dueDate);
  const start = safeParseDate(task.startDate) ?? (due ? safeParseDate(task.createdAt) : null);
  if (!start || !due || due < start) return null;
  return { start, due };
}

export function isTaskBlocked(task: Task) {
  return task.dependencies?.some((dependency) => dependency.relation === 'BLOCKED_BY' && !isDoneStatus(dependency.status)) ?? false;
}

export function isTaskOverdue(task: Task, today = startOfDay(new Date())) {
  const due = safeParseDate(task.dueDate);
  return Boolean(due && due < today && !isDoneStatus(task.status));
}

export function isTaskDueThisWeek(task: Task, today = startOfDay(new Date())) {
  const due = safeParseDate(task.dueDate);
  if (!due || isDoneStatus(task.status)) return false;
  const end = endOfWeek(today, { weekStartsOn: 1 });
  return due >= today && due <= end;
}

export function isTaskPastMilestone(task: Task, milestones: Milestone[]) {
  const due = safeParseDate(task.dueDate);
  if (!due || task.milestoneId == null) return false;
  const milestone = milestones.find((item) => item.id === task.milestoneId);
  const milestoneDue = safeParseDate(milestone?.dueDate);
  return Boolean(milestoneDue && due > milestoneDue);
}

export function getTimelineInsights(tasks: Task[], milestones: Milestone[], today = startOfDay(new Date())): TimelineInsight {
  return tasks.reduce<TimelineInsight>((summary, task) => {
    if (taskHasSchedule(task)) summary.scheduled += 1;
    else summary.unscheduled += 1;
    if (isTaskOverdue(task, today)) summary.overdue += 1;
    if (isTaskBlocked(task)) summary.blocked += 1;
    if (isTaskDueThisWeek(task, today)) summary.dueThisWeek += 1;
    if (task.milestoneId != null) summary.milestoneLinked += 1;
    if (isTaskPastMilestone(task, milestones)) summary.pastMilestone += 1;
    return summary;
  }, {
    scheduled: 0,
    unscheduled: 0,
    overdue: 0,
    blocked: 0,
    dueThisWeek: 0,
    milestoneLinked: 0,
    pastMilestone: 0,
  });
}

export function filterTimelineTasks(tasks: Task[], filters: TimelineFilters, milestones: Milestone[] = [], today = startOfDay(new Date())) {
  const query = filters.search.trim().toLowerCase();
  const selectedAssignees = (filters.assignees && filters.assignees.length > 0)
    ? filters.assignees
    : (filters.assignee ? [filters.assignee] : []);

  return tasks.filter((task) => {
    const schedule = getTaskSchedule(task);
    if (!filters.showDone && isDoneStatus(task.status)) return false;
    if (filters.schedule === 'scheduled' && !schedule) return false;
    if (filters.schedule === 'unscheduled' && schedule) return false;
    if (filters.focus === 'blocked' && !isTaskBlocked(task)) return false;
    if (filters.focus === 'overdue' && !isTaskOverdue(task, today)) return false;
    if (filters.focus === 'due-week' && !isTaskDueThisWeek(task, today)) return false;
    if (filters.focus === 'past-milestone' && !isTaskPastMilestone(task, milestones)) return false;

    if (selectedAssignees.length > 0) {
      const taskAssignees = [
        task.assigneeName,
        task.assignee?.name,
        ...(task.assignees?.map((a) => a.name) || []),
      ].filter((n): n is string => Boolean(n) && n !== 'Unassigned');

      const matchesAssignee = selectedAssignees.some((sel) =>
        sel === 'Unassigned'
          ? taskAssignees.length === 0
          : taskAssignees.includes(sel)
      );
      if (!matchesAssignee) return false;
    }

    if (filters.milestone === '__none__' && task.milestoneId != null) return false;
    if (filters.milestone && filters.milestone !== '__none__' && String(task.milestoneId ?? '') !== filters.milestone) return false;
    if (!query) return true;
    const allAssigneeNames = [
      task.assigneeName,
      task.assignee?.name,
      ...(task.assignees?.map((a) => a.name) || []),
    ].filter(Boolean);
    return [
      task.title,
      task.status,
      task.priority,
      ...allAssigneeNames,
      task.milestoneName,
      task.milestoneTitle,
      task.githubRepoFullName,
    ].filter(Boolean).some((field) => String(field).toLowerCase().includes(query));
  });
}

export function getTimelineDateRange(tasks: Task[]) {
  const schedules = tasks.map(getTaskSchedule).filter((schedule): schedule is { start: Date; due: Date } => Boolean(schedule));
  if (schedules.length === 0) return null;
  const minStart = schedules.reduce((min, schedule) => schedule.start < min ? schedule.start : min, schedules[0].start);
  const maxDue = schedules.reduce((max, schedule) => schedule.due > max ? schedule.due : max, schedules[0].due);
  return {
    start: startOfWeek(minStart, { weekStartsOn: 1 }),
    end: endOfWeek(maxDue, { weekStartsOn: 1 }),
  };
}

export function buildVisibleDays(range: { start: Date; end: Date } | null, hideWeekends: boolean) {
  if (!range) return [];
  const days = eachDayOfInterval(range);
  return hideWeekends ? days.filter((day) => !isWeekend(day)) : days;
}

export function buildTimelineUnits(visibleDays: Date[], zoom: TimelineZoom): TimelineUnit[] {
  if (zoom === 'day') {
    return visibleDays.map((day, index) => ({
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'd'),
      sublabel: format(day, 'EEEEE'),
      startIndex: index,
      span: 1,
      isWeekend: isWeekend(day),
    }));
  }

  const formatKey = zoom === 'week'
    ? (day: Date) => format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : (day: Date) => format(startOfMonth(day), 'yyyy-MM');
  const formatLabel = zoom === 'week'
    ? (day: Date) => `Week ${format(startOfWeek(day, { weekStartsOn: 1 }), 'MMM d')}`
    : (day: Date) => format(day, 'MMM yyyy');

  return visibleDays.reduce<TimelineUnit[]>((units, day, index) => {
    const key = formatKey(day);
    const last = units[units.length - 1];
    if (last && last.key === key) {
      last.span += 1;
      return units;
    }
    units.push({ key, label: formatLabel(day), startIndex: index, span: 1 });
    return units;
  }, []);
}

export function buildMonthGroups(visibleDays: Date[]) {
  return visibleDays.reduce<Array<{ label: string; span: number }>>((groups, day) => {
    const label = format(day, 'MMM yyyy');
    const last = groups[groups.length - 1];
    if (last?.label === label) last.span += 1;
    else groups.push({ label, span: 1 });
    return groups;
  }, []);
}

export function buildTimelineTasks(
  tasks: Task[],
  visibleDays: Date[],
  dayColumnWidth: number,
  milestones: Milestone[],
  activeDrag?: { taskId: number; type: 'move' | 'resize-right' } | null,
  dragOffset = 0,
  today = startOfDay(new Date()),
) {
  if (visibleDays.length === 0) return [];

  const dayIndexMap = new Map<string, number>();
  visibleDays.forEach((day, index) => dayIndexMap.set(format(day, 'yyyy-MM-dd'), index));
  const firstVisibleDay = visibleDays[0];
  const lastVisibleDay = visibleDays[visibleDays.length - 1];

  return tasks
    .map((task) => {
      const schedule = getTaskSchedule(task);
      if (!schedule) return null;
      if (schedule.due < firstVisibleDay || schedule.start > lastVisibleDay) return null;

      const clippedStart = schedule.start < firstVisibleDay ? firstVisibleDay : schedule.start;
      const clippedDue = schedule.due > lastVisibleDay ? lastVisibleDay : schedule.due;
      const startKey = format(clippedStart, 'yyyy-MM-dd');
      const dueKey = format(clippedDue, 'yyyy-MM-dd');
      let startIndex = dayIndexMap.get(startKey);
      let endIndex = dayIndexMap.get(dueKey);

      if (startIndex == null) {
        const nextVisible = visibleDays.findIndex((day) => day >= clippedStart);
        startIndex = nextVisible >= 0 ? nextVisible : undefined;
      }
      if (endIndex == null) {
        for (let index = visibleDays.length - 1; index >= 0; index -= 1) {
          if (visibleDays[index] <= clippedDue) {
            endIndex = index;
            break;
          }
        }
      }
      if (startIndex == null || endIndex == null || endIndex < startIndex) return null;

      const duration = Math.max(endIndex - startIndex + 1, 1);
      let previewStart = startIndex;
      let previewDuration = duration;
      if (activeDrag?.taskId === task.id && dragOffset !== 0) {
        if (activeDrag.type === 'move') previewStart = startIndex + dragOffset;
        else if (activeDrag.type === 'resize-right') previewDuration = Math.max(duration + dragOffset, 1);
      }

      return {
        ...task,
        startDateObj: schedule.start,
        dueDateObj: schedule.due,
        durationDays: Math.max(differenceInCalendarDays(schedule.due, schedule.start) + 1, 1),
        leftPx: Math.max(previewStart, 0) * dayColumnWidth,
        widthPx: Math.max(previewDuration * dayColumnWidth - 6, 30),
        isBlocked: isTaskBlocked(task),
        isOverdue: isTaskOverdue(task, today),
        isPastMilestone: isTaskPastMilestone(task, milestones),
      } satisfies TimelineTaskModel;
    })
    .filter((task): task is TimelineTaskModel => Boolean(task))
    .sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime() || a.dueDateObj.getTime() - b.dueDateObj.getTime());
}

export function groupTimelineTasks(tasks: TimelineTaskModel[], groupBy: TimelineGroupBy) {
  if (groupBy === 'none') return [{ key: 'all', label: 'All scheduled work', tasks }];
  const groups = new Map<string, TimelineTaskModel[]>();

  if (groupBy === 'assignee') {
    tasks.forEach((task) => {
      const assignees = [
        task.assigneeName,
        task.assignee?.name,
        ...(task.assignees?.map((a) => a.name) || []),
      ].filter((n): n is string => Boolean(n) && n !== 'Unassigned');

      const uniqueAssignees = Array.from(new Set(assignees));
      if (uniqueAssignees.length === 0) {
        const current = groups.get('Unassigned') ?? [];
        current.push(task);
        groups.set('Unassigned', current);
      } else {
        uniqueAssignees.forEach((name) => {
          const current = groups.get(name) ?? [];
          current.push(task);
          groups.set(name, current);
        });
      }
    });
  } else {
    tasks.forEach((task) => {
      const key = groupBy === 'status'
        ? statusLabel(task.status)
        : task.milestoneName || task.milestoneTitle || 'No milestone';
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    });
  }

  return Array.from(groups.entries()).map(([label, groupedTasks]) => ({
    key: `${groupBy}-${label}`,
    label,
    tasks: groupedTasks,
  }));
}

export function dateToKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function schedulePresetDates(preset: 'today' | 'week', today = startOfDay(new Date())) {
  if (preset === 'today') {
    const date = dateToKey(today);
    return { startDate: date, dueDate: date };
  }
  return {
    startDate: dateToKey(today),
    dueDate: dateToKey(addDays(today, 4)),
  };
}

export function getTimelineBoundsForZoom(range: { start: Date; end: Date } | null, zoom: TimelineZoom) {
  if (!range) return null;
  if (zoom === 'month') {
    return { start: startOfMonth(range.start), end: endOfMonth(range.end) };
  }
  return range;
}

export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible = 7
): (number | string)[] {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);

  if (safeCurrent <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (safeCurrent >= totalPages - 3) {
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    '...',
    safeCurrent - 1,
    safeCurrent,
    safeCurrent + 1,
    '...',
    totalPages,
  ];
}

export function paginateTimelineTasks<T>(
  items: T[],
  currentPage: number,
  pageSize: number
): T[] {
  if (pageSize <= 0) return items;
  const safePage = Math.max(1, currentPage);
  const startIndex = (safePage - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}
