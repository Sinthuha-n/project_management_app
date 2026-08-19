'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Diamond,
  Lock,
  Search,
} from 'lucide-react';
import { toast } from '@/components/ui';
import type { Task } from '../types';
import TimelineControls from './TimelineControls';
import TimelineTaskRow from './TimelineTaskRow';
import TimelinePagination from './TimelinePagination';
import { useTimelineDrag } from '../hooks/useTimelineDrag';
import { updateTaskDates } from '../api';
import {
  applyTaskMutation,
  createMutationId,
  isLatestTaskMutation,
  publishTaskMutation,
  revalidateTaskDependents,
} from '@/lib/task-cache';
import {
  DEFAULT_TIMELINE_PAGE_SIZE,
  TIMELINE_COLUMN_WIDTH,
  TIMELINE_PAGE_SIZE_OPTIONS,
  ZOOM_WIDTHS,
  buildMonthGroups,
  buildTimelineTasks,
  buildTimelineUnits,
  buildVisibleDays,
  dateToKey,
  filterTimelineTasks,
  getTaskSchedule,
  getTimelineBoundsForZoom,
  getTimelineDateRange,
  getTimelineInsights,
  groupTimelineTasks,
  paginateTimelineTasks,
  schedulePresetDates,
  statusLabel,
  type TimelineFilters,
  type TimelineGroupBy,
  type TimelineInsight,
  type TimelineZoom,
} from '../utils/timeline-utils';

export interface Milestone {
  id: number;
  name: string;
  dueDate?: string;
  status: string;
}

interface TimelineViewProps {
  projectId?: string | number;
  tasks: Task[];
  onOpenTask?: (taskId: number) => void;
  onTaskUpdated?: (taskId: number, updates: Partial<Task>) => void;
  milestones?: Milestone[];
  onInsightsChange?: (insights: TimelineInsight, rangeLabel: string) => void;
  onCreateTask?: () => void;
  onOpenBacklog?: () => void;
}

const DEFAULT_FILTERS: TimelineFilters = {
  search: '',
  assignee: '',
  assignees: [],
  milestone: '',
  schedule: '',
  focus: '',
  hideWeekends: false,
  showDone: true,
};

function makeRangeLabel(range: { start: Date; end: Date } | null) {
  if (!range) return 'No scheduled range';
  return `${format(range.start, 'MMM d, yyyy')} - ${format(range.end, 'MMM d, yyyy')}`;
}

function shiftRange(range: { start: Date; end: Date } | null, zoom: TimelineZoom, direction: -1 | 1) {
  if (!range) return null;
  const days = zoom === 'day' ? 14 : zoom === 'week' ? 28 : 90;
  return {
    start: addDays(range.start, days * direction),
    end: addDays(range.end, days * direction),
  };
}

function todayRange() {
  const today = startOfDay(new Date());
  return {
    start: addDays(startOfWeek(today, { weekStartsOn: 1 }), -14),
    end: addDays(today, 42),
  };
}

function RiskStrip({ insights }: { insights: TimelineInsight }) {
  const items = [
    { label: 'Overdue', value: insights.overdue, icon: AlertTriangle, tone: 'text-cu-danger bg-red-50 border-red-200' },
    { label: 'Blocked', value: insights.blocked, icon: Lock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Past milestone', value: insights.pastMilestone, icon: Diamond, tone: 'text-purple-700 bg-purple-50 border-purple-200' },
    { label: 'Unscheduled', value: insights.unscheduled, icon: CalendarClock, tone: 'text-cu-text-secondary bg-cu-bg-secondary border-cu-border' },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 ${item.tone}`}>
            <Icon size={16} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase">{item.label}</p>
              <p className="text-sm font-black">{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyTimeline({
  hasFilters,
  hasUnscheduledTasks,
  onClearFilters,
}: {
  hasFilters: boolean;
  hasUnscheduledTasks: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-xl border border-cu-border bg-cu-bg p-10 text-center shadow-cu-sm">
      {hasFilters ? <Search className="mx-auto h-9 w-9 text-cu-text-muted" /> : <Calendar className="mx-auto h-9 w-9 text-cu-text-muted" />}
      <h3 className="mt-3 text-base font-bold text-cu-text-primary">
        {hasFilters
          ? 'No scheduled work matches your filters'
          : hasUnscheduledTasks
            ? 'No scheduled work yet'
            : 'No project work yet'}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-cu-text-secondary">
        {hasFilters
          ? 'Clear filters to bring tasks back into the timeline.'
          : hasUnscheduledTasks
            ? 'Backlog and board tasks without dates are listed below so they can be scheduled here.'
            : 'Create a task from the timeline, backlog, or board to start planning project work.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 rounded-lg bg-cu-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-cu-primary-hover"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function AgendaFallback({
  tasks,
  milestones,
  onOpenTask,
}: {
  tasks: ReturnType<typeof buildTimelineTasks>;
  milestones: Milestone[];
  onOpenTask?: (taskId: number) => void;
}) {
  return (
    <div className="space-y-2 lg:hidden">
      {tasks.map((task) => {
        const milestone = task.milestoneId != null ? milestones.find((item) => item.id === task.milestoneId) : null;
        return (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask?.(task.id)}
            className="w-full rounded-xl border border-cu-border bg-cu-bg p-3 text-left shadow-cu-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-cu-text-primary">{task.title}</p>
                <p className="mt-1 text-xs font-medium text-cu-text-secondary">
                  {format(task.startDateObj, 'MMM d')} - {format(task.dueDateObj, 'MMM d')} · {statusLabel(task.status)}
                </p>
              </div>
              {task.isOverdue && <AlertTriangle size={16} className="flex-shrink-0 text-cu-danger" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
              <span className="rounded-md border border-cu-border bg-cu-bg-secondary px-2 py-1 text-cu-text-secondary">
                {task.assigneeName || 'Unassigned'}
              </span>
              {task.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-600">
                  <Lock size={11} />
                  Blocked
                </span>
              )}
              {milestone && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-purple-700">
                  <Diamond size={11} className="fill-current" />
                  {milestone.name}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function UnscheduledTray({
  tasks,
  onOpenTask,
  onScheduleTask,
}: {
  tasks: Task[];
  onOpenTask?: (taskId: number) => void;
  onScheduleTask: (task: Task, preset: 'today' | 'week') => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cu-border-light px-4 py-3">
        <div>
          <h3 className="text-sm font-black text-cu-text-primary">Unscheduled work</h3>
          <p className="text-xs text-cu-text-secondary">Plan these tasks without leaving the timeline.</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="divide-y divide-cu-border-light">
        {tasks.map((task) => (
          <div key={task.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-cu-text-primary">{task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-cu-text-tertiary">
                <span>{statusLabel(task.status)}</span>
                <span>{task.assigneeName || 'Unassigned'}</span>
                {task.priority && <span>{task.priority}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onScheduleTask(task, 'today')}
                className="rounded-lg border border-cu-border bg-cu-bg-secondary px-3 py-1.5 text-xs font-bold text-cu-text-primary transition-colors hover:bg-cu-hover"
              >
                Schedule today
              </button>
              <button
                type="button"
                onClick={() => onScheduleTask(task, 'week')}
                className="rounded-lg border border-cu-border bg-cu-bg-secondary px-3 py-1.5 text-xs font-bold text-cu-text-primary transition-colors hover:bg-cu-hover"
              >
                Schedule this week
              </button>
              <button
                type="button"
                onClick={() => onOpenTask?.(task.id)}
                className="rounded-lg bg-cu-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-cu-primary-hover"
              >
                Open task
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TimelineView({
  projectId,
  tasks,
  onOpenTask,
  onTaskUpdated,
  milestones = [],
  onInsightsChange,
  onCreateTask,
  onOpenBacklog,
}: TimelineViewProps) {
  const [zoom, setZoom] = useState<TimelineZoom>('day');
  const [groupBy, setGroupBy] = useState<TimelineGroupBy>('none');
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_TIMELINE_PAGE_SIZE);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [manualRange, setManualRange] = useState<{ start: Date; end: Date } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const numericProjectId = Number(projectId);

  const [prevTasks, setPrevTasks] = useState<Task[]>(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setLocalTasks(tasks);
  }

  const insights = useMemo(() => getTimelineInsights(localTasks, milestones), [localTasks, milestones]);
  const filteredTasks = useMemo(() => filterTimelineTasks(localTasks, filters, milestones), [localTasks, filters, milestones]);
  const scheduledSource = useMemo(() => filteredTasks.filter((task) => Boolean(getTaskSchedule(task))), [filteredTasks]);
  const unscheduledTasks = useMemo(() => filteredTasks.filter((task) => !getTaskSchedule(task)), [filteredTasks]);
  const baseRange = useMemo(() => getTimelineDateRange(scheduledSource), [scheduledSource]);
  const zoomRange = useMemo(() => getTimelineBoundsForZoom(manualRange ?? baseRange, zoom), [baseRange, manualRange, zoom]);
  const dayColumnWidth = ZOOM_WIDTHS[zoom];
  const visibleDays = useMemo(() => buildVisibleDays(zoomRange, filters.hideWeekends), [zoomRange, filters.hideWeekends]);
  const timelineWidthPx = visibleDays.length * dayColumnWidth;
  const timelineUnits = useMemo(() => buildTimelineUnits(visibleDays, zoom), [visibleDays, zoom]);
  const monthGroups = useMemo(() => buildMonthGroups(visibleDays), [visibleDays]);
  const todayKey = dateToKey(new Date());
  const todayOffset = visibleDays.findIndex((day) => dateToKey(day) === todayKey);

  const { activeDrag, dragOffset, startDrag } = useTimelineDrag(dayColumnWidth, milestones, onTaskUpdated, setLocalTasks);

  const timelineTasks = useMemo(
    () => buildTimelineTasks(scheduledSource, visibleDays, dayColumnWidth, milestones, activeDrag, dragOffset),
    [scheduledSource, visibleDays, dayColumnWidth, milestones, activeDrag, dragOffset]
  );
  const totalScheduledTasks = timelineTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalScheduledTasks / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalScheduledTasks);

  const paginatedTimelineTasks = useMemo(
    () => paginateTimelineTasks(timelineTasks, safeCurrentPage, pageSize),
    [timelineTasks, safeCurrentPage, pageSize]
  );
  const groupedTaskRows = useMemo(() => groupTimelineTasks(paginatedTimelineTasks, groupBy), [paginatedTimelineTasks, groupBy]);
  const currentRangeLabel = makeRangeLabel(zoomRange);
  const hasFilters = filters.search !== '' || (filters.assignees && filters.assignees.length > 0) || filters.assignee !== '' || filters.milestone !== '' || filters.schedule !== '' || filters.focus !== '' || filters.hideWeekends || !filters.showDone;
  const activeFilterCount = [
    filters.search ? 1 : 0,
    (filters.assignees && filters.assignees.length > 0) ? filters.assignees.length : (filters.assignee ? 1 : 0),
    filters.milestone ? 1 : 0,
    filters.schedule ? 1 : 0,
    filters.focus ? 1 : 0,
    filters.hideWeekends ? 1 : 0,
    !filters.showDone ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    localTasks.forEach((task) => {
      if (task.assigneeName && task.assigneeName !== 'Unassigned') names.add(task.assigneeName);
      if (task.assignees && task.assignees.length > 0) {
        task.assignees.forEach((a) => {
          if (a.name && a.name !== 'Unassigned') names.add(a.name);
        });
      }
    });
    return Array.from(names).sort();
  }, [localTasks]);

  const milestoneOptions = useMemo(
    () => milestones.map((milestone) => ({ id: milestone.id, name: milestone.name })),
    [milestones]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    onInsightsChange?.(insights, currentRangeLabel);
  }, [insights, currentRangeLabel, onInsightsChange]);

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  const scrollToToday = () => {
    if (todayOffset >= 0 && scrollContainerRef.current) {
      const target = todayOffset * dayColumnWidth - scrollContainerRef.current.clientWidth / 2 + TIMELINE_COLUMN_WIDTH;
      scrollContainerRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      return;
    }
    setManualRange(todayRange());
    window.setTimeout(() => {
      const index = visibleDays.findIndex((day) => dateToKey(day) === todayKey);
      if (index < 0 || !scrollContainerRef.current) return;
      const target = index * dayColumnWidth - scrollContainerRef.current.clientWidth / 2 + TIMELINE_COLUMN_WIDTH;
      scrollContainerRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }, 0);
    toast('Today is outside the current task range. Showing the current planning window.', 'info');
  };

  const handleRangeShift = (direction: -1 | 1) => {
    const nextRange = shiftRange(manualRange ?? zoomRange, zoom, direction);
    setManualRange(nextRange);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scheduleTask = async (task: Task, preset: 'today' | 'week') => {
    const updates = schedulePresetDates(preset);
    const previous = { startDate: task.startDate, dueDate: task.dueDate };
    const mutationProjectId = Number.isFinite(Number(task.projectId)) ? Number(task.projectId) : numericProjectId;
    const mutationId = createMutationId();
    setLocalTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...updates } : item));
    onTaskUpdated?.(task.id, updates);
    if (Number.isFinite(mutationProjectId)) {
      applyTaskMutation({
        operation: 'updated',
        projectId: mutationProjectId,
        taskId: task.id,
        mutationId,
        source: 'optimistic',
        patch: updates,
        occurredAt: new Date().toISOString(),
      });
    }
    try {
      const updatedTask = await updateTaskDates(task.id, updates.startDate, updates.dueDate);
      setLocalTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...updatedTask } : item));
      onTaskUpdated?.(task.id, updatedTask);
      if (Number.isFinite(mutationProjectId)) {
        const committed = {
          operation: 'updated' as const,
          projectId: mutationProjectId,
          taskId: task.id,
          mutationId,
          source: 'http' as const,
          task: updatedTask,
          occurredAt: new Date().toISOString(),
        };
        applyTaskMutation(committed);
        publishTaskMutation(committed);
        void revalidateTaskDependents(mutationProjectId);
      }
      toast('Task scheduled on the timeline.', 'success');
    } catch {
      setLocalTasks((prev) => prev.map((item) => item.id === task.id ? { ...item, ...previous } : item));
      onTaskUpdated?.(task.id, previous);
      if (Number.isFinite(mutationProjectId) && isLatestTaskMutation(task.id, mutationId)) {
        applyTaskMutation({
          operation: 'updated',
          projectId: mutationProjectId,
          taskId: task.id,
          mutationId,
          source: 'rollback',
          patch: previous,
          occurredAt: new Date().toISOString(),
        });
      }
      toast('Could not schedule task. Reverted the timeline update.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <TimelineControls
        zoom={zoom}
        onZoomChange={setZoom}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        assigneeOptions={assigneeOptions}
        milestoneOptions={milestoneOptions}
        currentLabel={currentRangeLabel}
        activeFilterCount={activeFilterCount}
        onPreviousRange={() => handleRangeShift(-1)}
        onNextRange={() => handleRangeShift(1)}
        onToday={scrollToToday}
        onClearFilters={clearFilters}
      />

      <RiskStrip insights={insights} />

      {timelineTasks.length === 0 ? (
        <EmptyTimeline hasFilters={hasFilters} hasUnscheduledTasks={unscheduledTasks.length > 0} onClearFilters={clearFilters} />
      ) : (
        <>
          <AgendaFallback tasks={paginatedTimelineTasks} milestones={milestones} onOpenTask={onOpenTask} />

          <div className="hidden max-w-full overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm lg:block">
            <div
              ref={scrollContainerRef}
              className="overflow-x-auto overflow-y-hidden custom-scrollbar touch-pan-x"
              style={{ cursor: activeDrag ? 'grabbing' : undefined }}
            >
              <div className="min-w-max" style={{ width: `${TIMELINE_COLUMN_WIDTH + timelineWidthPx}px` }}>
                <div className="sticky top-0 z-20 bg-cu-bg/95 backdrop-blur">
                  <div className="flex border-b border-cu-border">
                    <div className="sticky left-0 z-30 w-[320px] flex-shrink-0 border-r border-cu-border bg-cu-bg-secondary px-4 py-3">
                      <p className="text-xs font-black uppercase text-cu-text-secondary">Work item</p>
                    </div>
                    <div className="flex" style={{ width: `${timelineWidthPx}px` }}>
                      {monthGroups.map((group) => (
                        <div
                          key={`${group.label}-${group.span}`}
                          className="border-r border-cu-border bg-cu-bg-secondary px-3 py-3 text-xs font-black uppercase text-cu-text-secondary"
                          style={{ width: `${group.span * dayColumnWidth}px` }}
                        >
                          {group.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex border-b border-cu-border">
                    <div className="sticky left-0 z-30 w-[320px] flex-shrink-0 border-r border-cu-border bg-cu-bg-secondary px-4 py-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-cu-text-tertiary">
                        <Clock size={13} />
                        {timelineTasks.length} scheduled
                      </div>
                    </div>
                    <div className="flex" style={{ width: `${timelineWidthPx}px` }}>
                      {timelineUnits.map((unit) => (
                        <div
                          key={unit.key}
                          className={[
                            'flex h-11 flex-col items-center justify-center border-r border-cu-border-light text-[11px] font-bold',
                            unit.isWeekend ? 'bg-cu-bg-secondary text-cu-text-tertiary' : 'bg-cu-bg text-cu-text-secondary',
                          ].join(' ')}
                          style={{ width: `${unit.span * dayColumnWidth}px` }}
                        >
                          <span>{unit.label}</span>
                          {unit.sublabel && <span className="text-[10px] uppercase text-cu-text-muted">{unit.sublabel}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {groupedTaskRows.map((group) => {
                  const collapsed = collapsedGroups.has(group.key);
                  return (
                    <div key={group.key}>
                      {groupBy !== 'none' && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex w-full items-center gap-2 border-b border-cu-border bg-cu-bg-secondary px-4 py-2 text-left text-xs font-black uppercase text-cu-text-secondary transition-colors hover:bg-cu-hover"
                        >
                          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          {group.label}
                          <span className="rounded-full bg-cu-bg px-2 py-0.5 text-[10px]">{group.tasks.length}</span>
                        </button>
                      )}
                      {!collapsed && group.tasks.map((task) => (
                        <TimelineTaskRow
                          key={task.id}
                          task={task}
                          visibleDays={visibleDays}
                          dayColumnWidth={dayColumnWidth}
                          timelineWidthPx={timelineWidthPx}
                          todayOffset={todayOffset}
                          milestones={milestones}
                          isDragging={activeDrag?.taskId === task.id}
                          onOpenTask={onOpenTask}
                          onStartDragMove={(event, timelineTask) => startDrag(event, timelineTask, 'move')}
                          onStartDragResizeRight={(event, timelineTask) => startDrag(event, timelineTask, 'resize-right')}
                          activeDragTaskId={activeDrag?.taskId}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <TimelinePagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalScheduledTasks}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSizeOptions={TIMELINE_PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      <UnscheduledTray tasks={unscheduledTasks} onOpenTask={onOpenTask} onScheduleTask={scheduleTask} />

      {timelineTasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-xs text-cu-text-secondary shadow-cu-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 font-bold"><CheckCircle2 size={13} /> Done visible: {filters.showDone ? 'yes' : 'no'}</span>
            <span className="inline-flex items-center gap-1 font-bold"><CalendarClock size={13} /> Weekends: {filters.hideWeekends ? 'hidden' : 'shown'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onCreateTask && (
              <button type="button" onClick={onCreateTask} className="font-bold text-cu-primary hover:underline">
                Create task
              </button>
            )}
            {onOpenBacklog && (
              <button type="button" onClick={onOpenBacklog} className="font-bold text-cu-primary hover:underline">
                Open backlog
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
