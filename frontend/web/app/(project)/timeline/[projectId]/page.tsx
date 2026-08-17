'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TimelineView from '../../kanban/components/TimelineView';
import { Task } from '../../kanban/types';
import { createTask as createTimelineTask } from '../../kanban/api';
import { AlertCircle, CalendarClock, CalendarRange, Diamond, ListChecks, Lock, Plus, RefreshCw } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { getMilestones } from '@/services/milestone-service';
import type { MilestoneResponse } from '@/types';
import EmptyState from '@/components/shared/EmptyState';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { TimelineInsight } from '../../kanban/utils/timeline-utils';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { useProjectTasks } from '@/hooks/useProjectTasks';

export default function TimelinePage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const taskMutations = useTaskMutations(projectId);
  const projectTasks = useProjectTasks(projectId, false);

  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleRangeLabel, setVisibleRangeLabel] = useState('No scheduled range');
  const [timelineInsights, setTimelineInsights] = useState<TimelineInsight>({
    scheduled: 0,
    unscheduled: 0,
    overdue: 0,
    blocked: 0,
    dueThisWeek: 0,
    milestoneLinked: 0,
    pastMilestone: 0,
  });
  const tasks = useMemo(() => projectTasks.tasks as unknown as Task[], [projectTasks.tasks]);
  const loading = projectTasks.loading;
  const error = projectTasks.error ? 'Failed to load timeline tasks.' : null;

  const timelineStats = useMemo(() => {
    return {
      total: tasks.length,
      scheduled: timelineInsights.scheduled,
      unscheduled: timelineInsights.unscheduled,
      overdue: timelineInsights.overdue,
      blocked: timelineInsights.blocked,
      dueThisWeek: timelineInsights.dueThisWeek,
      milestones: timelineInsights.milestoneLinked || milestones.length,
    };
  }, [tasks, milestones, timelineInsights]);

  const timelineMilestones = useMemo(
    () => milestones.map((ms) => ({ id: ms.id, name: ms.name, dueDate: ms.dueDate, status: ms.status })),
    [milestones],
  );

  const loadMilestones = useCallback(async () => {
    const pid = parseInt(projectId, 10);
    if (isNaN(pid)) return;
    try {
      const data = await getMilestones(pid);
      setMilestones(data);
    } catch {
      setMilestones([]);
    }
  }, [projectId]);

  useTaskWebSocket(projectId, (event) => {
    if ((event.type === 'TASK_UPDATED' || event.type === 'TASK_CREATED') && event.task?.milestoneId !== undefined) {
      void loadMilestones();
    }
  });

  useEffect(() => {
    queueMicrotask(() => void loadMilestones());
  }, [loadMilestones]);

  useEffect(() => {
    const refreshMilestones = () => { void loadMilestones(); };
    window.addEventListener('planora:milestone-updated', refreshMilestones);
    return () => {
      window.removeEventListener('planora:milestone-updated', refreshMilestones);
    };
  }, [loadMilestones]);

  const handleCreateTask = (data: CreateTaskData) => {
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) return;
    const payload = {
      projectId: projectIdNum,
      title: data.title,
      status: data.status || 'TODO',
      priority: data.priority,
      storyPoint: data.storyPoint,
      assigneeId: data.assigneeId,
      labelIds: data.labelIds,
      dueDate: data.dueDate,
    };
    taskMutations.create(payload, (request) => createTimelineTask(request as typeof payload));
  };

  const handleTimelineInsightsChange = useCallback((insights: TimelineInsight, rangeLabel: string) => {
    setTimelineInsights((current) => (
      current.scheduled === insights.scheduled &&
      current.unscheduled === insights.unscheduled &&
      current.overdue === insights.overdue &&
      current.blocked === insights.blocked &&
      current.dueThisWeek === insights.dueThisWeek &&
      current.milestoneLinked === insights.milestoneLinked &&
      current.pastMilestone === insights.pastMilestone
        ? current
        : insights
    ));
    setVisibleRangeLabel((current) => (current === rangeLabel ? current : rangeLabel));
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-cu-bg-secondary overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-[1500px] mx-auto w-full">
        <div className="sticky-section-header glass-panel border border-cu-border rounded-2xl px-4 sm:px-6 py-4 mb-4 shadow-cu-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cu-primary text-white shadow-cu-sm">
                  <CalendarRange size={17} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-cu-text-primary sm:text-2xl">Timeline</h1>
                  <p className="mt-0.5 text-xs text-cu-text-secondary sm:text-sm">
                    {timelineStats.scheduled} scheduled of {timelineStats.total} tasks · {visibleRangeLabel}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-cu-primary px-3 text-sm font-bold text-white transition-colors hover:bg-cu-primary-hover"
                >
                  <Plus size={15} />
                  Create task
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/backlog?projectId=${projectId}`)}
                  className="inline-flex h-9 items-center rounded-lg border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover"
                >
                  Open backlog
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-w-[640px]">
              {[
                { label: 'Scheduled', value: timelineStats.scheduled, icon: CalendarRange, tone: 'text-cu-primary' },
                { label: 'Unscheduled', value: timelineStats.unscheduled, icon: CalendarClock, tone: 'text-amber-600' },
                { label: 'Overdue', value: timelineStats.overdue, icon: AlertCircle, tone: 'text-cu-danger' },
                { label: 'Blocked', value: timelineStats.blocked, icon: Lock, tone: 'text-red-600' },
                { label: 'Due week', value: timelineStats.dueThisWeek, icon: ListChecks, tone: 'text-cu-success' },
                { label: 'Milestones', value: timelineStats.milestones, icon: Diamond, tone: 'text-purple-600' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-cu-border bg-cu-bg px-3 py-2 shadow-cu-sm">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cu-text-secondary">
                      <Icon size={11} className={item.tone} />
                      {item.label}
                    </p>
                    <p className={`mt-1 text-lg font-black ${item.tone}`}>{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5">
            <EmptyState
              icon={<AlertCircle size={24} />}
              title="Unable to load timeline"
              subtitle={error}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void projectTasks.revalidate()}
                    className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-cu-primary-hover transition-colors"
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/backlog?projectId=${projectId}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-cu-border bg-cu-bg px-4 py-2.5 text-sm font-semibold text-cu-text-primary hover:bg-cu-hover transition-colors"
                  >
                    Open backlog
                  </button>
                </div>
              }
            />
          </div>
        )}

        {/* Loading skeleton */}
        {loading && tasks.length === 0 ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-full rounded-xl" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl w-full" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : (
          <TimelineView
            projectId={projectId}
            tasks={tasks}
            onOpenTask={setSelectedTaskId}
            milestones={timelineMilestones}
            onInsightsChange={handleTimelineInsightsChange}
            onCreateTask={() => setShowCreateModal(true)}
            onOpenBacklog={() => router.push(`/backlog?projectId=${projectId}`)}
          />
        )}

        {showCreateModal && (
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreateTask={handleCreateTask}
            projectId={parseInt(projectId, 10)}
          />
        )}

        {selectedTaskId !== null && (
          <TaskCardModal
            taskId={selectedTaskId}
            onClose={() => {
              setSelectedTaskId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
