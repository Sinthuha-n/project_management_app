'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, type PanInfo } from 'framer-motion';
import { AlertCircle, CalendarCheck2, CalendarDays, Clock, Flag, RefreshCw } from 'lucide-react';
import { useBreakpoint } from '@/lib/useBreakpoint';
import EmptyState from '@/components/shared/EmptyState';
import CalendarToolbar from './components/CalendarToolbar';
import MonthCalendarView from './components/MonthCalendarView';
import WeekCalendarView from './components/WeekCalendarView';
import AgendaCalendarView from './components/AgendaCalendarView';
import type { CalendarEventItem, CalendarFilters, CalendarView } from './types';
import { addDays, addMonths, formatMonthLabel, formatWeekLabel, getCalendarSummary, toDateKey } from './utils/date';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { normalizeTaskPriority } from '@/services/tasks-contract';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useTaskMutations } from '@/hooks/useTaskMutations';

const DEFAULT_FILTERS: CalendarFilters = {
  search: '',
  assignees: [],
  types: [],
  statuses: [],
  moreFilters: [],
};

const TYPE_OPTIONS = [
  'All standard work types',
  'All sub-tasks',
  'Standard work types',
  'Epic',
  'Bug',
  'Story',
  'Task',
  'Subtask',
  'Show full list',
];

const STATUS_OPTIONS = ['Planned', 'Active', 'Completed', 'To Do', 'In Progress', 'Done'];

const MORE_FILTER_OPTIONS = [
  'Attachment',
  'Comment',
  'Created',
  'Creator',
  'Description',
  'Design',
  'Development',
  'Due date',
  'Environment',
];

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const includesByNormalize = (values: string[], target?: string) => {
  if (values.length === 0) return true;
  const n = normalize(target);
  return values.some((item) => normalize(item) === n);
};

const evaluateMoreFilter = (event: CalendarEventItem, selectedMoreFilter: string) => {
  switch (normalize(selectedMoreFilter)) {
    case 'attachment':
      return Boolean(event.hasAttachment);
    case 'comment':
      return Boolean(event.hasComment);
    case 'creator':
    case 'created':
      return Boolean(event.creator);
    case 'description':
      return Boolean(event.description);
    case 'environment':
      return Boolean(event.environment);
    case 'design':
      return normalize(event.environment) === 'design';
    case 'development':
      return normalize(event.environment) === 'development';
    case 'due date':
      return Boolean(event.dueDate);
    default:
      return true;
  }
};

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const {
    events,
    loading,
    error,
    revalidate,
    appendEvent,
    removeEvent,
    patchEventDate,
    refreshOneTask,
  } = useCalendarEvents(projectId);
  const taskMutations = useTaskMutations(projectId);

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const assigneeOptions = useMemo(() => {
    const uniqueAssignees = Array.from(
      new Set(events.map((event) => event.assignee).filter((value): value is string => Boolean(value)))
    );
    return ['All assignees', ...uniqueAssignees];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.search.trim()) {
        const q = normalize(filters.search);
        const hit = [event.title, event.description, event.assignee, event.status, event.type]
          .filter(Boolean)
          .some((field) => normalize(field).includes(q));
        if (!hit) return false;
      }

      if (!includesByNormalize(filters.assignees, event.assignee)) return false;
      if (!includesByNormalize(filters.types.filter((item) => !item.toLowerCase().includes('all') && item !== 'Show full list' && item !== 'Standard work types'), event.type || event.kind)) return false;
      if (!includesByNormalize(filters.statuses, event.status)) return false;

      if (filters.moreFilters.length > 0) {
        const allMatch = filters.moreFilters.every((item) => evaluateMoreFilter(event, item));
        if (!allMatch) return false;
      }

      return true;
    });
  }, [events, filters]);

  const currentLabel = useMemo(() => {
    if (view === 'month') return formatMonthLabel(currentDate);
    if (view === 'week') return formatWeekLabel(currentDate);

    const end = addDays(currentDate, 13);
    const left = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const right = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${left} - ${right}`;
  }, [currentDate, view]);

  const summary = useMemo(() => getCalendarSummary(filteredEvents), [filteredEvents]);

  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate((prev) => addMonths(prev, -1));
      return;
    }
    if (view === 'week') {
      setCurrentDate((prev) => addDays(prev, -7));
      return;
    }
    setCurrentDate((prev) => addDays(prev, -14));
  };

  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
      return;
    }
    if (view === 'week') {
      setCurrentDate((prev) => addDays(prev, 7));
      return;
    }
    setCurrentDate((prev) => addDays(prev, 14));
  };

  const handleToday = () => setCurrentDate(new Date());

  const { isMobile } = useBreakpoint();

  const handlePanEnd = (_: unknown, info: PanInfo) => {
    if (!isMobile) return;
    if (info.offset.x < -60) handleNext();
    else if (info.offset.x > 60) handlePrev();
  };

  const handleDayClick = (date: Date) => {
    setPrefilledDate(toDateKey(date));
    setShowCreateModal(true);
  };

  const handleCreateTask = (data: CreateTaskData) => {
    if (!projectId) return;
    const result = taskMutations.create({
      projectId: parseInt(projectId, 10),
      title: data.title,
      priority: normalizeTaskPriority(data.priority),
      storyPoint: data.storyPoint,
      assigneeId: data.assigneeId,
      labelIds: data.labelIds,
      dueDate: data.dueDate,
    });
    appendEvent(result.optimisticTask);
    void result.completion
      .then((serverTask) => appendEvent(serverTask, result.optimisticTask.id))
      .catch(() => removeEvent(result.optimisticTask.id));
  };

  const handleEventDrop = async (eventId: string, newDate: Date) => {
    await patchEventDate(eventId, newDate);
  };

  if (!projectId) {
    return (
      <div className="min-h-full bg-transparent">
        <EmptyState
          icon={<CalendarDays size={24} />}
          title="Select a project to view its calendar"
          subtitle="Choose a project from your dashboard to see scheduled tasks and important dates."
          action={(
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
            >
              Go to Dashboard
            </Link>
          )}
          className="min-h-[60vh]"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="sticky-section-header glass-panel flex flex-col gap-4 rounded-2xl px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cu-primary text-white shadow-cu-sm">
                <CalendarDays size={17} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-cu-text-primary sm:text-2xl">Calendar</h1>
                <p className="mt-0.5 text-xs text-cu-text-secondary sm:text-sm">
                  {filteredEvents.length} visible of {events.length} scheduled item{events.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            {[
              { label: 'Today', value: summary.today, icon: Clock, tone: 'text-cu-primary' },
              { label: 'Scheduled', value: summary.scheduled, icon: CalendarCheck2, tone: 'text-cu-primary' },
              { label: 'Overdue', value: summary.overdue, icon: AlertCircle, tone: 'text-cu-danger' },
              { label: 'Sprints', value: summary.sprints, icon: Flag, tone: 'text-cu-success' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl glass-panel px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cu-text-secondary">
                    <Icon size={11} className={item.tone} />
                    {item.label}
                  </p>
                  <p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <CalendarToolbar
          view={view}
          currentLabel={currentLabel}
          filters={filters}
          assigneeOptions={assigneeOptions}
          typeOptions={TYPE_OPTIONS}
          statusOptions={STATUS_OPTIONS}
          moreFilterOptions={MORE_FILTER_OPTIONS}
          onViewChange={setView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          onAssigneesChange={(values) => setFilters((prev) => ({ ...prev, assignees: values }))}
          onTypesChange={(values) => setFilters((prev) => ({ ...prev, types: values }))}
          onStatusesChange={(values) => setFilters((prev) => ({ ...prev, statuses: values }))}
          onMoreFiltersChange={(values) => setFilters((prev) => ({ ...prev, moreFilters: values }))}
        />

        {loading && events.length === 0 && (
          <div className="space-y-3 rounded-xl glass-panel p-4">
            <div className="skeleton h-10 w-48 rounded-lg" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, index) => (
                <div key={index} className="skeleton h-24 rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {!loading && error && events.length === 0 && (
          <EmptyState
            icon={<AlertCircle size={24} />}
            title="Unable to load calendar"
            subtitle={error}
            action={
              <button
                type="button"
                onClick={() => revalidate()}
                className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            }
            className="rounded-xl glass-panel"
          />
        )}

        {((!loading && !error) || events.length > 0) && filteredEvents.length === 0 && (
          <EmptyState
            icon={<CalendarDays size={24} />}
            title={events.length === 0 ? 'No scheduled work yet' : 'No calendar items match your filters'}
            subtitle={events.length === 0 ? 'Create tasks with due dates or start a sprint to see work on the calendar.' : 'Try clearing search or filters to bring scheduled work back into view.'}
            action={events.length === 0 ? (
              <button
                type="button"
                onClick={() => handleDayClick(new Date())}
                className="inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
              >
                Create task
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
              >
                Clear filters
              </button>
            )}
            className="rounded-xl glass-panel"
          />
        )}

        {((!loading && !error) || events.length > 0) && filteredEvents.length > 0 && (
          <motion.div onPanEnd={handlePanEnd} className="touch-pan-y">
            {view === 'month' && (
              <MonthCalendarView
                currentDate={currentDate}
                events={filteredEvents}
                onDayClick={handleDayClick}
                onEventDrop={handleEventDrop}
                onOpenTask={setSelectedTaskId}
              />
            )}
            {view === 'week' && (
              <WeekCalendarView
                currentDate={currentDate}
                events={filteredEvents}
                onDayClick={handleDayClick}
                onEventDrop={handleEventDrop}
                onOpenTask={setSelectedTaskId}
              />
            )}
            {view === 'agenda' && (
              <AgendaCalendarView
                currentDate={currentDate}
                events={filteredEvents}
                onOpenTask={setSelectedTaskId}
              />
            )}
          </motion.div>
        )}

        {showCreateModal && projectId && (
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => { setShowCreateModal(false); setPrefilledDate(undefined); }}
            onCreateTask={handleCreateTask}
            projectId={parseInt(projectId, 10)}
            initialDueDate={prefilledDate}
          />
        )}

        {selectedTaskId !== null && (
          <TaskCardModal
            taskId={selectedTaskId}
            onClose={(wasModified) => {
              const tid = selectedTaskId;
              setSelectedTaskId(null);
              if (wasModified) void refreshOneTask(tid);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading calendar" subtitle="Preparing the project calendar." variant="cards" />}>
      <CalendarPageContent />
    </Suspense>
  );
}
