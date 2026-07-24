'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, KanbanColumnConfig, Label } from '../types';
import {
  fetchTasksByProject,
  fetchKanbanBoard,
  fetchProjectLabels,
  fetchProject,
  fetchTeamMembers,
  TeamMemberOption,
} from '../api';
import { tasksApi } from '@/services/api-contract';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useVisibilityInterval } from '@/hooks/useVisibilityInterval';

export const DEFAULT_COLUMN_CONFIGS: KanbanColumnConfig[] = [
  { id: 0, status: 'TODO', title: 'To Do', color: '', wipLimit: 0 },
  { id: 0, status: 'IN_PROGRESS', title: 'In Progress', color: '', wipLimit: 0 },
  { id: 0, status: 'IN_REVIEW', title: 'In Review', color: '', wipLimit: 0 },
  { id: 0, status: 'DONE', title: 'Done', color: '', wipLimit: 0 },
];

export function useKanbanData(projectId: string | null) {
  const canonicalTasks = useProjectTasks(projectId, false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnConfigs, setColumnConfigs] = useState<KanbanColumnConfig[]>(DEFAULT_COLUMN_CONFIGS);
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [kanbanId, setKanbanId] = useState<number | null>(null);
  const [activeMobileColumn, setActiveMobileColumn] = useState<string>(DEFAULT_COLUMN_CONFIGS[0].status);

  // Keep a ref so syncCache can read the latest tasks without a stale closure.
  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const columnConfigsRef = useRef<KanbanColumnConfig[]>(columnConfigs);
  useEffect(() => { columnConfigsRef.current = columnConfigs; }, [columnConfigs]);
  const kanbanIdRef = useRef<number | null>(kanbanId);
  useEffect(() => { kanbanIdRef.current = kanbanId; }, [kanbanId]);

  useEffect(() => {
    if (!canonicalTasks.authoritative) return;
    const next = canonicalTasks.tasks as unknown as Task[];
    setTasks(next);
    tasksRef.current = next;
  }, [canonicalTasks.authoritative, canonicalTasks.tasks]);

  // ── Local Task Helpers ──────────────────────────────────────────────────────

  /**
   * Insert a new task or merge an updated task into the local array.
   * If a task with the same id already exists it is replaced in-place;
   * otherwise the task is appended.
   */
  const upsertTask = useCallback((updated: Task) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...updated };
        return next;
      }
      return [...prev, updated];
    });
  }, []);

  /**
   * Apply a partial patch to a single task without touching the rest.
   */
  const patchTask = useCallback((taskId: number, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
  }, []);

  /**
   * Remove a task from the local array by id.
   */
  const removeTask = useCallback((taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  /**
   * Write the current task array into the session cache so the next mount
   * gets the up-to-date order/status without waiting for a network round-trip.
   */
  const syncCache = useCallback((updatedTasks: Task[]) => {
    if (!projectId) return;
    const cKey = buildSessionCacheKey('kanban-board', [projectId]);
    if (!cKey) return;
    const existing = getSessionCache<{ columns: KanbanColumnConfig[]; tasks: Task[]; kanbanId: number | null }>(
      cKey,
      { allowStale: true }
    );
    setSessionCache(
      cKey,
      {
        columns: existing.data?.columns ?? columnConfigsRef.current,
        tasks: updatedTasks,
        kanbanId: existing.data?.kanbanId ?? kanbanIdRef.current,
      },
      30 * 60_000
    );
  }, [projectId]);

  // ── Static Data (Run once per project) ──

  const fetchStaticData = useCallback(async () => {
    if (!projectId) return;
    const pid = Number(projectId);
    try {
      const [project, labelsData] = await Promise.all([
        fetchProject(pid),
        fetchProjectLabels(pid),
      ]);
      setLabels(labelsData);
      if (project?.teamId) {
        const members = await fetchTeamMembers(project.teamId as number);
        setTeamMembers(members);
        const map: Record<string, string | null> = {};
        members.forEach(m => { map[m.name] = null; });
        setUsersMap(map);
      }
    } catch (err) {
      console.error('Error loading static kanban data:', err);
    }
  }, [projectId]);

  // ── Dynamic Data (Periodic Sync) ──

  const fetchData = useCallback(async (options: { showSpinner?: boolean, forceNetwork?: boolean } = {}) => {
    if (!projectId) return;
    const { showSpinner = true, forceNetwork = false } = options;
    const pid = Number(projectId);

    const cKey = buildSessionCacheKey('kanban-board', [projectId]);
    if (cKey && !forceNetwork) {
      const cached = getSessionCache<{ columns: KanbanColumnConfig[]; tasks: Task[]; kanbanId: number | null }>(cKey, { allowStale: true });
      if (cached.data) {
        if (cached.data.columns?.length) {
          setColumnConfigs(cached.data.columns);
          setActiveMobileColumn(cached.data.columns[0].status);
        }
        if (cached.data.tasks) setTasks(cached.data.tasks);
        if (cached.data.kanbanId) setKanbanId(cached.data.kanbanId);
        setLoading(false);
      }
    }

    // Only show the large board spinner when there is nothing to display yet.
    // If stale cached data is already rendered, let it remain while we refresh
    // silently in the background.
    if (showSpinner && tasksRef.current.length === 0) setLoading(true);
    setError(null);
    try {
      const [boardData, taskData] = await Promise.all([
        fetchKanbanBoard(pid),
        fetchTasksByProject(pid),
      ]);
      if (boardData?.columns?.length) {
        setColumnConfigs(boardData.columns);
        setActiveMobileColumn(boardData.columns[0].status);
      }
      if (boardData?.kanbanId) setKanbanId(boardData.kanbanId);
      setTasks(taskData);

      if (cKey) {
        setSessionCache(cKey, { columns: boardData?.columns ?? [], tasks: taskData, kanbanId: boardData?.kanbanId ?? null }, 30 * 60_000);
      }
    } catch (err) {
      console.error('Error loading kanban board:', err);
      // Only surface the error banner when we have nothing to show.
      if (tasksRef.current.length === 0) setError('Failed to load board. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    void fetchStaticData();
    void fetchData({ showSpinner: true });
  }, [projectId, fetchStaticData, fetchData]);

  useVisibilityInterval(() => void fetchData({ showSpinner: false }), 30_000, Boolean(projectId));

  // ── WebSocket real-time task updates ──────────────────────────────────────

  useTaskWebSocket(projectId, useCallback((event) => {
    if (event.type === 'TASK_CREATED' && event.task) {
      const t = event.task as Task;
      setTasks(prev => {
        if (prev.some(x => x.id === t.id)) return prev;
        return [...prev, t];
      });
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      const t = event.task as Task;
      // Merge server data; preserves any local-only optimistic fields
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...t } : x));
    } else if (event.type === 'TASK_STATUS_CHANGED' && event.taskId && event.status) {
      // Lightweight patch — avoids a full task re-render for status-only changes
      setTasks(prev => prev.map(x => x.id === event.taskId ? { ...x, status: event.status! } : x));
    } else if (event.type === 'TASK_DELETED' && event.taskId) {
      setTasks(prev => prev.filter(x => x.id !== event.taskId));
    }
  }, []));

  // ── Custom event: planora:task-updated (dispatched by TaskCardModal on save) ──

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ task?: Task; taskId?: number }>).detail;
      if (detail?.task) {
        // Full task object provided — patch directly without a network call.
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id === detail.task!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...prev[idx], ...detail.task! };
            return next;
          }
          return [...prev, detail.task!];
        });
      } else if (detail?.taskId) {
        // Only taskId provided — fetch the single task to get fresh data.
        try {
          const fetched = await tasksApi.get(detail.taskId);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === fetched.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...prev[idx], ...fetched };
              return next;
            }
            return [...prev, fetched];
          });
        } catch (err) {
          console.error('Failed to fetch updated task:', err);
        }
      }
    };

    window.addEventListener('planora:task-updated', handler);
    return () => window.removeEventListener('planora:task-updated', handler);
  }, []);

  return {
    tasks,
    setTasks,
    loading,
    error,
    columnConfigs,
    setColumnConfigs,
    usersMap,
    teamMembers,
    labels,
    setLabels,
    kanbanId,
    activeMobileColumn,
    setActiveMobileColumn,
    // Local mutation helpers
    upsertTask,
    patchTask,
    removeTask,
    syncCache,
    forceRefresh: () => void fetchData({ showSpinner: false, forceNetwork: true }),
  };
}
