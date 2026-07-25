'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarEventItem } from '../types';
import { fetchCalendarEvents, patchTaskDates, mapTaskToCalendarEvent } from '../api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { tasksApi } from '@/services/tasks-contract';
import type { Task } from '@/types';
import { toDateKey } from '../utils/date';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { applyTaskMutation, createMutationId, publishTaskMutation } from '@/lib/task-cache';

function updateCalendarSessionCache(projectId: string | null, events: CalendarEventItem[]) {
  if (!projectId) return;
  const key = buildSessionCacheKey('calendar-events', [projectId]);
  if (key) setSessionCache(key, events, 30 * 60 * 1000);
}

function getInitialCalendarState(projectId: string | null): { events: CalendarEventItem[]; loading: boolean } {
  if (!projectId) return { events: [], loading: false };
  const cKey = buildSessionCacheKey('calendar-events', [projectId]);
  if (cKey) {
    const cached = getSessionCache<CalendarEventItem[]>(cKey, { allowStale: true });
    if (cached.data) {
      return { events: cached.data, loading: false };
    }
  }
  return { events: [], loading: true };
}

export function useCalendarEvents(projectId: string | null) {
  const [events, setEvents] = useState<CalendarEventItem[]>(() => getInitialCalendarState(projectId).events);
  const [loading, setLoading] = useState<boolean>(() => getInitialCalendarState(projectId).loading);
  const [error, setError] = useState<string | null>(null);
  const patchingTaskIdsRef = useRef<Set<number>>(new Set());
  const canonicalTasks = useProjectTasks(projectId, false);

  // Calendar task events are projections of the canonical project task cache.
  // Sprint events remain owned by the calendar endpoint.
  useEffect(() => {
    if (!canonicalTasks.authoritative) return;
    queueMicrotask(() => setEvents((previous) => {
      const sprints = previous.filter((event) => event.kind === 'sprint');
      const taskEvents = canonicalTasks.tasks
        .filter((task) => !task.archived && Boolean(task.startDate || task.dueDate))
        .map(mapTaskToCalendarEvent);
      const next = [...sprints, ...taskEvents];
      updateCalendarSessionCache(projectId, next);
      return next;
    }));
  }, [canonicalTasks.authoritative, canonicalTasks.tasks, projectId]);

  // Background/Initial fetch
  const revalidate = useCallback(
    async (options: { showSpinner?: boolean; forceNetwork?: boolean } = {}) => {
      if (!projectId) return;
      const { showSpinner = true, forceNetwork = false } = options;

      const cKey = buildSessionCacheKey('calendar-events', [projectId]);
      if (cKey && !forceNetwork) {
        const cached = getSessionCache<CalendarEventItem[]>(cKey, { allowStale: true });
        if (cached.data) {
          setEvents(cached.data);
          setLoading(false);
        }
      }

      if (showSpinner) setLoading(true);
      setError(null);

      try {
        const data = await fetchCalendarEvents(projectId);
        setEvents(data);
        if (cKey) {
          setSessionCache(cKey, data, 30 * 60 * 1000); // 30 mins TTL
        }
      } catch {
        setError('Failed to load calendar events.');
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [projectId]
  );

  // Mount/Project ID change SWR logic
  useEffect(() => {
    if (!projectId) return;

    const cKey = buildSessionCacheKey('calendar-events', [projectId]);
    const cached = cKey ? getSessionCache<CalendarEventItem[]>(cKey, { allowStale: true }) : { data: null };
    if (cached.data) {
      const cachedData = cached.data;
      queueMicrotask(() => {
        setEvents(cachedData);
        setLoading(false);
        void revalidate({ showSpinner: false, forceNetwork: false });
      });
    } else {
      queueMicrotask(() => {
        setLoading(true);
        void revalidate({ showSpinner: true });
      });
    }
  }, [projectId, revalidate]);

  // Helper to persist current state to cache
  const updateCache = useCallback(
    (nextEvents: CalendarEventItem[]) => {
      if (!projectId) return;
      const cKey = buildSessionCacheKey('calendar-events', [projectId]);
      if (cKey) {
        setSessionCache(cKey, nextEvents, 30 * 60 * 1000);
      }
    },
    [projectId]
  );

  // Appends one task without refetching
  const appendEvent = useCallback(
    (task: Task, replacesTaskId?: number) => {
      const mapped = mapTaskToCalendarEvent(task);
      setEvents((prev) => {
        const withoutOptimistic = replacesTaskId == null
          ? prev
          : prev.filter((event) => event.taskId !== replacesTaskId);
        const next = withoutOptimistic.some((event) => event.id === mapped.id)
          ? withoutOptimistic.map((event) => event.id === mapped.id ? mapped : event)
          : [...withoutOptimistic, mapped];
        updateCache(next);
        return next;
      });
    },
    [updateCache]
  );

  const removeEvent = useCallback((taskId: number) => {
    setEvents((prev) => {
      const next = prev.filter((event) => event.taskId !== taskId);
      updateCache(next);
      return next;
    });
  }, [updateCache]);

  // Optimistic date patching
  const patchEventDate = useCallback(
    async (eventId: string, newDate: Date) => {
      const dateStr = toDateKey(newDate);
      const event = events.find((e) => e.id === eventId);
      if (!event || !event.taskId) return;

      const taskId = event.taskId;
      if (patchingTaskIdsRef.current.has(taskId)) return;
      patchingTaskIdsRef.current.add(taskId);

      // Snapshot for revert on failure
      const originalEvent = { ...event };
      const mutationId = createMutationId();

      // Optimistic update
      setEvents((prev) => {
        const next = prev.map((e) =>
          e.id === eventId
            ? { ...e, startDate: dateStr, dueDate: dateStr, endDate: dateStr }
            : e
        );
        updateCache(next);
        return next;
      });
      applyTaskMutation({
        operation: 'updated', projectId: Number(projectId), taskId, mutationId,
        source: 'optimistic', patch: { startDate: dateStr, dueDate: dateStr }, occurredAt: new Date().toISOString(),
      });

      try {
        const updatedTask = await patchTaskDates(taskId, dateStr, dateStr);
        const authoritativeEvent = mapTaskToCalendarEvent(updatedTask);
        const committed = {
          operation: 'updated' as const, projectId: Number(projectId), taskId, mutationId,
          source: 'http' as const, task: updatedTask, occurredAt: new Date().toISOString(),
        };
        applyTaskMutation(committed);
        publishTaskMutation(committed);
        setEvents((prev) => {
          const next = prev.map((e) => (e.id === eventId ? authoritativeEvent : e));
          updateCache(next);
          return next;
        });
      } catch {
        // Revert only this event
        setEvents((prev) => {
          const next = prev.map((e) => (e.id === eventId ? originalEvent : e));
          updateCache(next);
          return next;
        });
        applyTaskMutation({
          operation: 'updated', projectId: Number(projectId), taskId, mutationId,
          source: 'rollback', patch: {
            startDate: originalEvent.startDate,
            dueDate: originalEvent.dueDate,
          }, occurredAt: new Date().toISOString(),
        });
      } finally {
        patchingTaskIdsRef.current.delete(taskId);
      }
    },
    [events, projectId, updateCache]
  );

  // Refresh only single task
  const refreshOneTask = useCallback(
    async (taskId: number) => {
      try {
        const task = await tasksApi.get(taskId);
        const mapped = mapTaskToCalendarEvent(task);
        const hasDates = Boolean(task.startDate || task.dueDate);
        const isArchived = Boolean(task.archived);

        setEvents((prev) => {
          let next: CalendarEventItem[];
          if (!hasDates || isArchived) {
            next = prev.filter((e) => e.taskId !== taskId);
          } else {
            const index = prev.findIndex((e) => e.taskId === taskId);
            if (index > -1) {
              next = prev.map((e) => (e.taskId === taskId ? mapped : e));
            } else {
              next = [...prev, mapped];
            }
          }
          updateCache(next);
          return next;
        });
      } catch {
        // Keep existing if fetch fails (e.g. temporary network drop)
      }
    },
    [updateCache]
  );

  // WebSocket event integration
  useTaskWebSocket(
    projectId,
    useCallback(
      (event) => {
        if (event.type === 'TASK_CREATED' && event.task) {
          const task = event.task as Task;
          const hasDates = Boolean(task.startDate || task.dueDate);
          const isArchived = Boolean(task.archived);

          if (hasDates && !isArchived) {
            const mapped = mapTaskToCalendarEvent(task);
            setEvents((prev) => {
              if (prev.some((e) => e.id === mapped.id)) {
                return prev;
              }
              const next = [...prev, mapped];
              updateCache(next);
              return next;
            });
          }
        } else if (event.type === 'TASK_UPDATED' && event.task) {
          const task = event.task as Task;
          const hasDates = Boolean(task.startDate || task.dueDate);
          const isArchived = Boolean(task.archived);
          const mapped = mapTaskToCalendarEvent(task);

          setEvents((prev) => {
            let next: CalendarEventItem[];
            if (!hasDates || isArchived) {
              next = prev.filter((e) => e.taskId !== task.id);
            } else {
              const index = prev.findIndex((e) => e.taskId === task.id);
              if (index > -1) {
                next = prev.map((e) => (e.taskId === task.id ? mapped : e));
              } else {
                next = [...prev, mapped];
              }
            }
            updateCache(next);
            return next;
          });
        } else if (event.type === 'TASK_DELETED' && event.taskId != null) {
          const taskId = event.taskId;
          setEvents((prev) => {
            const next = prev.filter((e) => e.taskId !== taskId);
            updateCache(next);
            return next;
          });
        }
      },
      [updateCache]
    )
  );

  return {
    events,
    loading,
    error,
    revalidate: () => void revalidate({ showSpinner: true, forceNetwork: true }),
    appendEvent,
    removeEvent,
    patchEventDate,
    refreshOneTask,
    patchingTaskIdsRef,
  };
}
