'use client';

import { AlertTriangle, BarChart3, Rocket, Archive } from 'lucide-react';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';
import FilterBar, { type BacklogFilters } from './components/FilterBar';
import BulkActionBar from './components/BulkActionBar';
import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
const VelocityChart = dynamic(() => import('./components/VelocityChart'), { ssr: false });
import type { SprintVelocityPoint } from './components/VelocityChart';
import { getUserFromToken } from '@/lib/auth';

import { toast } from '@/components/ui';
import { getProjectLabels, createLabel } from '@/services/labels-service';
import type { TaskItem, SprintItem, Label } from '@/types';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { useTaskStore } from '@/stores/task-store';
import { buildSessionCacheKey, getSessionCache, setSessionCache, removeSessionCache } from '@/lib/session-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { projectsApi, sprintboardsApi, sprintsApi, tasksApi } from '@/services/api-contract';
import { normalizeTaskPriority } from '@/services/tasks-contract';

const LABEL_PALETTE = ["#EF4444","#F97316","#F59E0B","#84CC16","#22C55E","#14B8A6","#06B6D4","#3B82F6","#6366F1","#8B5CF6","#EC4899","#6B7280"];

type CacheShape = {
  productTasks: TaskItem[];
  sprints: SprintItem[];
  projectKey: string;
};

type RawTask = {
  id: number;
  projectTaskNumber?: number;
  backlogPosition?: number | null;
  sprintPosition?: number | null;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
  labels?: Label[];
  archived?: boolean;
};

interface ProjectMember {
  user: {
    userId: number;
    email?: string;
  };
  role: string;
}

function SprintBacklogPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const projectIdNum = projectId ? Number(projectId) : null;

  const cachedTasks       = useTaskStore((s) => (projectIdNum ? s.tasksByProject[projectIdNum] : undefined));
  const setTasksForProject = useTaskStore((s) => s.setTasksForProject);

  const [loading, setLoading] = useState(!cachedTasks);
  const [error, setError] = useState<string | null>(null);
  const [productTasks, setProductTasks] = useState<TaskItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showVelocity, setShowVelocity] = useState(false);
  const [velocityData, setVelocityData] = useState<SprintVelocityPoint[]>([]);
  const [projectKey, setProjectKey] = useState<string>('');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Array<{ id: number; name: string; color?: string }>>([]);
  const [activeBoardStatuses, setActiveBoardStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<BacklogFilters>({
    search: '',
    statuses: [],
    priorities: [],
    assignee: '',
  });

  const allAssigneeNames = useMemo(() => {
    const names = new Set<string>();
    productTasks.forEach((t) => { if (t.assigneeName && t.assigneeName !== 'Unassigned') names.add(t.assigneeName); });
    sprints.forEach((s) => s.tasks.forEach((t) => { if (t.assigneeName && t.assigneeName !== 'Unassigned') names.add(t.assigneeName); }));
    return Array.from(names).sort();
  }, [productTasks, sprints]);

  const applyFilters = useCallback((tasks: TaskItem[]): TaskItem[] => {
    return tasks.filter((t) => {
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(t.status ?? 'TODO')) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority ?? 'LOW')) return false;
      if (filters.assignee && t.assigneeName !== filters.assignee) return false;
      return true;
    });
  }, [filters]);

  const filteredProductTasks = useMemo(() => applyFilters(productTasks), [productTasks, applyFilters]);
  const filteredSprints = useMemo(() => {
    return sprints
      .filter((s) => s.status !== 'COMPLETED')
      .map((s) => ({ ...s, tasks: applyFilters(s.tasks) }));
  }, [sprints, applyFilters]);

  const mapRawTask = (raw: RawTask): TaskItem => ({
    id: raw.id,
    taskNo: raw.projectTaskNumber ?? raw.id,
    projectTaskNumber: raw.projectTaskNumber ?? raw.id,
    title: raw.title,
    storyPoints: raw.storyPoint,
    selected: false,
    assigneeName: raw.assigneeName ?? 'Unassigned',
    assigneePhotoUrl: raw.assigneePhotoUrl ?? null,
    sprintId: raw.sprintId ?? null,
    status: raw.status ?? 'TODO',
    startDate: raw.startDate ?? '',
    dueDate: raw.dueDate ?? '',
    labels: raw.labels ?? [],
    archived: raw.archived ?? false,
  });

  const persistOrder = useCallback(async (targetSprintId: number | null, orderedTaskIds: number[]) => {
    if (!projectId || orderedTaskIds.length === 0) return;
    await tasksApi.reorderTasks({
      projectId: Number(projectId),
      sprintId: targetSprintId,
      orderedTaskIds,
    });
  }, [projectId]);

  const fetchStaticData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [membersRes, projectRes, labelsRes] = await Promise.all([
        projectsApi.getMembers(projectId),
        projectsApi.get(projectId),
        getProjectLabels(Number(projectId)),
      ]);

      const membersData = membersRes as ProjectMember[];
      setProjectLabels(Array.isArray(labelsRes) ? labelsRes : []);

      const currentUser = getUserFromToken();
      if (currentUser && membersData) {
        const projectMember = membersData.find((m: ProjectMember) =>
          m.user.userId === currentUser.userId || (currentUser.email && m.user.email?.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (projectMember) setCurrentUserRole(projectMember.role);
      }
      setProjectKey((projectRes as { projectKey?: string }).projectKey || '');
    } catch (err) {
      console.error('Failed to fetch project static data:', err);
    }
  }, [projectId]);

  const fetchData = useCallback(async (options: { showSpinner?: boolean; forceNetwork?: boolean } = {}) => {
    const { showSpinner = true, forceNetwork = false } = options;
    if (!projectId) return;
    
    const cKey = buildSessionCacheKey('sprint-backlog', [projectId, showArchived.toString()]);
    let hasCachedData = false;
    if (cKey && !forceNetwork) {
      const cached = getSessionCache<CacheShape>(cKey, { allowStale: true });
      if (cached.data) {
        setProductTasks(cached.data.productTasks);
        setSprints(cached.data.sprints);
        setProjectKey(cached.data.projectKey);
        setLoading(false);
        hasCachedData = true;
      }
    }

    if (showSpinner && !hasCachedData) setLoading(true);
    try {
      const tasksPromises = [
        tasksApi.listAllByProject(projectId),
      ];
      if (showArchived) {
        tasksPromises.push(tasksApi.listAllByProject(projectId, { archived: true }));
      }

      const [rawSprints, ...tasksResList] = await Promise.all([
        sprintsApi.listByProject(projectId),
        ...tasksPromises,
      ]);
      const rawTasks: RawTask[] = [];
      tasksResList.forEach((res) => {
        rawTasks.push(...(res as RawTask[]));
      });
      const uniqueRaw = Array.from(new Map(rawTasks.map(t => [t.id, t])).values());
      const mappedTasks = uniqueRaw.map((t) => mapRawTask(t));

      if (projectIdNum) {
        setTasksForProject(projectIdNum, mappedTasks);
      }

      const backlogTasks = mappedTasks.filter((t) => !t.sprintId);
      const sprintTaskMap = new Map<number, TaskItem[]>();
      mappedTasks.filter((t) => t.sprintId).forEach((t) => {
        const sid = t.sprintId!;
        if (!sprintTaskMap.has(sid)) sprintTaskMap.set(sid, []);
        sprintTaskMap.get(sid)!.push(t);
      });

      const newSprints: SprintItem[] = rawSprints.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startDate: s.startDate ?? undefined,
        endDate: s.endDate ?? undefined,
        goal: (s as SprintItem & { goal?: string }).goal ?? '',
        tasks: sprintTaskMap.get(s.id) ?? []
      }));

      setSprints(newSprints);
      setProductTasks(backlogTasks);
      setError(null);

      const activeSprint = rawSprints.find((s) => s.status === 'ACTIVE');
      if (activeSprint) {
        sprintboardsApi.get(activeSprint.id)
          .then((res) => {
            const defaultStatuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
            const extra = (res.columns ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((c: any) => !defaultStatuses.includes(c.columnStatus))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((c: any) => ({ value: c.columnStatus, label: c.columnName }));
            setActiveBoardStatuses(extra);
          }).catch(() => {});
      }

      if (cKey) {
        setSessionCache(cKey, { productTasks: backlogTasks, sprints: newSprints, projectKey }, 60 * 60_000);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (showSpinner) setError(err.response?.data?.message || 'Access denied or project not found.');
    } finally {
      if (showSpinner && !hasCachedData) setLoading(false);
    }
  }, [projectId, projectIdNum, projectKey, setTasksForProject, showArchived]);

  const createSprint = useCallback(async (name: string, startDate?: string, endDate?: string, goal?: string) => {
    const trimmed = name.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await sprintsApi.create({
        proId: Number(projectId),
        name: trimmed,
        startDate: startDate || null,
        endDate: endDate || null,
        goal: goal || null,
      });
      const created = response as { id: number; name: string; status: string; startDate?: string; endDate?: string; goal?: string };

      const selectedTasks = productTasks.filter((task) => task.selected);
      const remainingTasks = productTasks.filter((task) => !task.selected);

      await Promise.all(
        selectedTasks.map((task) => tasksApi.update(task.id, { sprintId: created.id }))
      );

      const cleanedTasks = selectedTasks.map((task) => ({ ...task, selected: false, sprintId: created.id }));
      setSprints((prev) => [...prev, {
        id: created.id,
        name: created.name,
        status: created.status,
        startDate: created.startDate,
        endDate: created.endDate,
        goal: created.goal ?? '',
        tasks: cleanedTasks
      }]);
      if (selectedTasks.length > 0) setProductTasks(remainingTasks);
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create sprint.', 'error');
    }
  }, [projectId, productTasks, fetchData]);

  const toggleTaskSelection = useCallback((id: number) => {
    setProductTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, selected: !task.selected } : task))
    );
    setSprints((prev) =>
      prev.map((sprint) => ({
        ...sprint,
        tasks: sprint.tasks.map((task) =>
          task.id === id ? { ...task, selected: !task.selected } : task
        ),
      }))
    );
  }, []);

  const updateTaskStoryPoints = useCallback(async (id: number, points: number) => {
    const value = Number.isNaN(points) ? 0 : points;
    setProductTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, storyPoints: value } : task
      )
    );
    try {
      await tasksApi.update(id, { storyPoint: value });
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch {
      toast('Failed to update story points', 'error');
    }
  }, [projectId, fetchData]);

  const createTask = useCallback(async (data: CreateTaskData) => {
    const trimmed = data.title.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await tasksApi.create({
        projectId: Number(projectId),
        title: trimmed,
        storyPoint: data.storyPoint ?? 0,
        priority: normalizeTaskPriority(data.priority),
        assigneeId: data.assigneeId,
        labelIds: data.labelIds,
      });
      const raw = response as RawTask;
      const newTask: TaskItem = {
        id: raw.id,
        taskNo: raw.projectTaskNumber ?? raw.id,
        projectTaskNumber: raw.projectTaskNumber ?? raw.id,
        title: raw.title,
        storyPoints: raw.storyPoint,
        selected: false,
        assigneeName: 'Unassigned',
        sprintId: null,
      };
      setProductTasks((prev) => [...prev.filter((x) => x.id !== raw.id), newTask]);
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  }, [projectId, fetchData]);

  const createSprintTask = useCallback(async (title: string, sprintId: number) => {
    const trimmed = title.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await tasksApi.create({
        projectId: Number(projectId),
        title: trimmed,
        storyPoint: 0,
        sprintId,
      });
      const raw = response as RawTask;
      const newTask: TaskItem = {
        id: raw.id,
        taskNo: raw.projectTaskNumber ?? raw.id,
        projectTaskNumber: raw.projectTaskNumber ?? raw.id,
        title: raw.title,
        storyPoints: raw.storyPoint,
        selected: false,
        assigneeName: 'Unassigned',
        sprintId,
      };
      setSprints((prev) =>
        prev.map((s) =>
          s.id === sprintId
            ? { ...s, tasks: [...s.tasks.filter((x) => x.id !== newTask.id), newTask] }
            : s
        )
      );
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  }, [projectId, fetchData]);

  const moveTask = useCallback(async (
    taskId: number,
    toSprintId: number | null,
    targetIndex?: number
  ) => {
    let draggedTask: TaskItem | undefined;
    let fromSprintId: number | null = null;
    let fromIndex = -1;

    fromIndex = productTasks.findIndex((task) => task.id === taskId);
    if (fromIndex >= 0) {
      draggedTask = productTasks[fromIndex];
      fromSprintId = null;
    } else {
      for (const sprint of sprints) {
        const idx = sprint.tasks.findIndex((task) => task.id === taskId);
        if (idx >= 0) {
          draggedTask = sprint.tasks[idx];
          fromSprintId = sprint.id;
          fromIndex = idx;
          break;
        }
      }
    }
    if (!draggedTask || fromIndex < 0) return;

    const isSameList = fromSprintId === toSprintId;
    const desiredIndex = targetIndex == null ? Number.MAX_SAFE_INTEGER : Math.max(0, targetIndex);

    const insertAt = (arr: TaskItem[], item: TaskItem, idx: number) => {
      const next = [...arr];
      const bounded = Math.max(0, Math.min(idx, next.length));
      next.splice(bounded, 0, item);
      return next;
    };

    const removeAt = (arr: TaskItem[], idx: number) => {
      const next = [...arr];
      next.splice(idx, 1);
      return next;
    };

    if (isSameList) {
      if (fromSprintId === null) {
        const without = removeAt(productTasks, fromIndex);
        const adjusted = desiredIndex > fromIndex ? desiredIndex - 1 : desiredIndex;
        const finalList = insertAt(without, { ...draggedTask, sprintId: null }, adjusted);
        setProductTasks(finalList);
        try {
          await persistOrder(null, finalList.map((t) => t.id));
        } catch {
          void fetchData({ showSpinner: false, forceNetwork: true });
        }
      } else {
        const sourceSprint = sprints.find((s) => s.id === fromSprintId);
        if (!sourceSprint) return;
        const without = removeAt(sourceSprint.tasks, fromIndex);
        const adjusted = desiredIndex > fromIndex ? desiredIndex - 1 : desiredIndex;
        const finalList = insertAt(without, { ...draggedTask, sprintId: fromSprintId }, adjusted);
        setSprints((prev) => prev.map((sprint) => sprint.id === fromSprintId ? { ...sprint, tasks: finalList } : sprint));
        try {
          await persistOrder(fromSprintId, finalList.map((t) => t.id));
        } catch {
          void fetchData({ showSpinner: false, forceNetwork: true });
        }
      }
      return;
    }

    let sourceRemainingIds: number[] = [];
    if (fromSprintId === null) {
      const remaining = removeAt(productTasks, fromIndex);
      sourceRemainingIds = remaining.map((t) => t.id);
      setProductTasks(remaining);
    } else {
      const sourceSprint = sprints.find((s) => s.id === fromSprintId);
      if (sourceSprint) {
        const remaining = removeAt(sourceSprint.tasks, fromIndex);
        sourceRemainingIds = remaining.map((t) => t.id);
        setSprints((prev) => prev.map((s) => s.id === fromSprintId ? { ...s, tasks: remaining } : s));
      }
    }

    let reorderedTargetIds: number[] = [];
    if (toSprintId === null) {
      const finalBacklog = insertAt(productTasks.filter((t) => t.id !== taskId), { ...draggedTask, sprintId: null }, desiredIndex);
      reorderedTargetIds = finalBacklog.map((t) => t.id);
      setProductTasks(finalBacklog);
    } else {
      const targetSprint = sprints.find((s) => s.id === toSprintId);
      if (!targetSprint) return;
      const finalSprintTasks = insertAt(targetSprint.tasks.filter((t) => t.id !== taskId), { ...draggedTask, sprintId: toSprintId }, desiredIndex);
      reorderedTargetIds = finalSprintTasks.map((t) => t.id);
      setSprints((prev) => prev.map((s) => s.id === toSprintId ? { ...s, tasks: finalSprintTasks } : s));
    }

    try {
      await tasksApi.update(taskId, { sprintId: toSprintId });
      if (fromSprintId !== toSprintId) {
        await persistOrder(fromSprintId, sourceRemainingIds);
      }
      await persistOrder(toSprintId, reorderedTargetIds);
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to move task.', 'error');
      void fetchData({ showSpinner: false, forceNetwork: true });
    }
  }, [projectId, productTasks, sprints, fetchData, persistOrder]);

  const moveTaskToSprint = useCallback((taskId: number, sprintId: number, targetIndex?: number) => {
    void moveTask(taskId, sprintId, targetIndex);
  }, [moveTask]);

  const moveTaskToBacklog = useCallback((taskId: number, targetIndex?: number) => {
    void moveTask(taskId, null, targetIndex);
  }, [moveTask]);

  const handleTaskStatusChange = useCallback(async (taskId: number, newStatus: string) => {
    try {
      await tasksApi.updateStatus(taskId, newStatus);
      setProductTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setSprints(prev => prev.map(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      })));
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      void fetchData({ showSpinner: false, forceNetwork: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to update status.', 'error');
    }
  }, [projectId, fetchData]);

  const handleTaskDueDateChange = useCallback(async (taskId: number, dueDate: string) => {
    const normalized = dueDate ? dueDate.slice(0, 10) : '';
    setProductTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, dueDate: normalized } : t));
    setSprints((prev) => prev.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => t.id === taskId ? { ...t, dueDate: normalized } : t),
    })));
    try {
      await tasksApi.updateDates(taskId, { dueDate: normalized || null });
      const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
      if (cKey) removeSessionCache(cKey);
    } catch {
      toast('Failed to update due date.', 'error');
      void fetchData({ showSpinner: false, forceNetwork: true });
    }
  }, [projectId, fetchData]);

  const handleSprintDeleted = useCallback((sprintId: number, tasks: SprintItem['tasks']) => {
    setSprints(prev => prev.filter(s => s.id !== sprintId));
    setProductTasks(prev => [
      ...prev,
      ...tasks.map(t => ({ ...t, sprintId: null })),
    ]);
    const cKey = buildSessionCacheKey('sprint-backlog', [projectId]);
    if (cKey) removeSessionCache(cKey);
    void fetchData({ showSpinner: false, forceNetwork: true });
  }, [projectId, fetchData]);

  const handleCreateLabel = useCallback(async (name: string) => {
    const color = LABEL_PALETTE[Math.floor(Math.random() * LABEL_PALETTE.length)];
    const newLabel = await createLabel(Number(projectId), name, color);
    setProjectLabels((prev) => [...prev, newLabel]);
    return newLabel;
  }, [projectId]);

  const getSelectedTaskIds = useCallback((): number[] => {
    const ids: number[] = [];
    productTasks.forEach(t => { if (t.selected) ids.push(t.id); });
    sprints.forEach(s => s.tasks.forEach(t => { if (t.selected) ids.push(t.id); }));
    return ids;
  }, [productTasks, sprints]);

  const handleClearSelection = useCallback(() => {
    setProductTasks(prev => prev.map(t => ({ ...t, selected: false })));
    setSprints(prev => prev.map(s => ({
      ...s, tasks: s.tasks.map(t => ({ ...t, selected: false }))
    })));
  }, []);

  const handleBulkMoveToSprint = useCallback(async (targetSprintId: number) => {
    const ids = getSelectedTaskIds();
    try {
      await Promise.all(ids.map(id => tasksApi.update(id, { sprintId: targetSprintId })));
      const movedFromBacklog = productTasks.filter(t => t.selected);
      const movedFromSprints: TaskItem[] = [];
      sprints.forEach(s => {
        if (s.id !== targetSprintId) {
          s.tasks.filter(t => t.selected).forEach(t => movedFromSprints.push(t));
        }
      });
      const allMoved = [...movedFromBacklog, ...movedFromSprints].map(t => ({ ...t, selected: false, sprintId: targetSprintId }));
      setProductTasks(prev => prev.filter(t => !t.selected));
      setSprints(prev => prev.map(s => {
        if (s.id === targetSprintId) {
          const kept = s.tasks.filter(t => !t.selected).map(t => ({ ...t, selected: false }));
          return { ...s, tasks: [...kept, ...allMoved] };
        }
        return { ...s, tasks: s.tasks.filter(t => !t.selected) };
      }));
      toast(`Moved ${ids.length} task(s) to sprint`, 'success');
    } catch {
      toast('Failed to move tasks', 'error');
    }
  }, [getSelectedTaskIds, productTasks, sprints]);

  const handleBulkMoveToBacklog = useCallback(async () => {
    const ids: number[] = [];
    const movedTasks: TaskItem[] = [];
    sprints.forEach(s => s.tasks.forEach(t => {
      if (t.selected) { ids.push(t.id); movedTasks.push({ ...t, selected: false, sprintId: null }); }
    }));
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => tasksApi.update(id, { sprintId: null })));
      setSprints(prev => prev.map(s => ({ ...s, tasks: s.tasks.filter(t => !t.selected) })));
      setProductTasks(prev => [...prev.map(t => ({ ...t, selected: false })), ...movedTasks]);
      toast(`Moved ${ids.length} task(s) to backlog`, 'success');
    } catch {
      toast('Failed to move tasks to backlog', 'error');
    }
  }, [sprints]);

  const handleBulkStatusChange = useCallback(async (status: string) => {
    const ids = getSelectedTaskIds();
    if (ids.length === 0) return;
    try {
      await tasksApi.bulkUpdateStatus({ taskIds: ids, status });
      setProductTasks(prev => prev.map(t => t.selected ? { ...t, status, selected: false } : t));
      setSprints(prev => prev.map(s => ({
        ...s, tasks: s.tasks.map(t => t.selected ? { ...t, status, selected: false } : t)
      })));
      toast(`Updated ${ids.length} task(s) to ${status.replace('_', ' ')}`, 'success');
    } catch {
      toast('Failed to update task statuses', 'error');
    }
  }, [getSelectedTaskIds]);

  const handleBulkDelete = useCallback(async () => {
    const ids = getSelectedTaskIds();
    if (ids.length === 0) return;
    try {
      await tasksApi.bulkDelete({ taskIds: ids });
      setProductTasks(prev => prev.filter(t => !t.selected));
      setSprints(prev => prev.map(s => ({ ...s, tasks: s.tasks.filter(t => !t.selected) })));
      toast(`Deleted ${ids.length} task(s)`, 'success');
    } catch {
      toast('Failed to delete tasks', 'error');
    }
  }, [getSelectedTaskIds]);

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      setLoading(false);
      return;
    }
    void fetchStaticData();
    void fetchData({ showSpinner: true });
    const syncId = setInterval(() => void fetchData({ showSpinner: false }), 30_000);
    return () => clearInterval(syncId);
  }, [projectId, fetchStaticData, fetchData]);

  useEffect(() => {
    const onTaskUpdated = () => { void fetchData({ showSpinner: false, forceNetwork: true }); };
    window.addEventListener('planora:task-updated', onTaskUpdated);
    return () => window.removeEventListener('planora:task-updated', onTaskUpdated);
  }, [fetchData]);

  useTaskWebSocket(projectId, useCallback((event) => {
    if (event.type === 'TASK_CREATED' && event.task) {
      const t = event.task;
      const newTask: TaskItem = {
        id: t.id,
        taskNo: t.projectTaskNumber ?? t.id,
        projectTaskNumber: t.projectTaskNumber ?? t.id,
        title: t.title,
        storyPoints: t.storyPoint ?? 0,
        selected: false,
        assigneeName: t.assigneeName ?? 'Unassigned',
        assigneePhotoUrl: t.assigneePhotoUrl ?? null,
        sprintId: t.sprintId ?? null,
        status: t.status ?? 'TODO',
        priority: t.priority ?? 'LOW',
        archived: t.archived ?? false,
      };
      if (newTask.archived && !showArchived) {
        return;
      }
      if (newTask.sprintId) {
        setSprints(prev => prev.map(s =>
          s.id === newTask.sprintId
            ? { ...s, tasks: [...s.tasks.filter(x => x.id !== newTask.id), newTask] }
            : s
        ));
      } else {
        setProductTasks(prev => [...prev.filter(x => x.id !== newTask.id), newTask]);
      }
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      const t = event.task;
      const updated: Partial<TaskItem> = {
        title: t.title,
        taskNo: t.projectTaskNumber ?? t.id,
        projectTaskNumber: t.projectTaskNumber ?? t.id,
        storyPoints: t.storyPoint ?? 0,
        status: t.status ?? 'TODO',
        priority: t.priority ?? 'LOW',
        assigneeName: t.assigneeName ?? 'Unassigned',
        assigneePhotoUrl: t.assigneePhotoUrl ?? null,
        sprintId: t.sprintId ?? null,
        dueDate: t.dueDate ?? '',
        archived: t.archived ?? false,
      };

      const updateList = (prev: TaskItem[], targetSprintId: number | null | undefined) => {
        const existingIndex = prev.findIndex(x => x.id === t.id);
        const existing = existingIndex >= 0 ? prev[existingIndex] : undefined;
        const filtered = prev.filter(x => x.id !== t.id);
        if (t.archived && !showArchived) {
          return filtered;
        }
        if (!t.sprintId && targetSprintId === null) {
          const taskToUse = existing || { id: t.id } as TaskItem;
          if (existingIndex < 0) return [...filtered, { ...taskToUse, ...updated }];
          const next = [...prev];
          next[existingIndex] = { ...taskToUse, ...updated };
          return next;
        }
        return filtered;
      };

      setProductTasks(prev => updateList(prev, null));
      setSprints(prev => prev.map(s => {
        const existingIndex = s.tasks.findIndex(x => x.id === t.id);
        const existing = existingIndex >= 0 ? s.tasks[existingIndex] : undefined;
        const filtered = s.tasks.filter(x => x.id !== t.id);
        if (t.archived && !showArchived) {
          return { ...s, tasks: filtered };
        }
        if (s.id === t.sprintId) {
          const taskToUse = existing || { id: t.id } as TaskItem;
          if (existingIndex < 0) {
            return { ...s, tasks: [...filtered, { ...taskToUse, ...updated }] };
          }
          const next = [...s.tasks];
          next[existingIndex] = { ...taskToUse, ...updated };
          return { ...s, tasks: next };
        }
        return { ...s, tasks: filtered };
      }));
    } else if (event.type === 'TASK_DELETED' && event.taskId) {
      const deletedId = event.taskId;
      setProductTasks(prev => prev.filter(x => x.id !== deletedId));
      setSprints(prev => prev.map(s => ({
        ...s, tasks: s.tasks.filter(x => x.id !== deletedId)
      })));
    }
  }, [showArchived]));

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;
    if (action === 'create-sprint') {
      void createSprint(`${projectKey} Sprint ${sprints.length + 1}`);
    } else if (action === 'add-task') {
      setShowCreateTaskModal(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams, projectKey, sprints.length, createSprint]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowCreateTaskModal(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!showVelocity || !projectId) return;
    sprintsApi.getVelocity(projectId)
      .then((data) => setVelocityData(data.map((point, index) => ({
        sprintId: index + 1,
        ...point,
      }))))
      .catch(() => setVelocityData([]));
  }, [showVelocity, projectId]);

  const selectedCount = useMemo(() => {
    const backlogSelected = productTasks.filter(t => t.selected).length;
    const sprintSelected = sprints.reduce((acc, s) => acc + s.tasks.filter(t => t.selected).length, 0);
    return backlogSelected + sprintSelected;
  }, [productTasks, sprints]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 overflow-hidden">
      <div className="sticky top-0 flex-shrink-0 z-40 w-full glass-panel border-b border-[#E4E7EC] px-4 py-3 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <FilterBar filters={filters} onChange={setFilters} assigneeNames={allAssigneeNames} />
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 pt-0.5">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all active:scale-95 ${
                showArchived ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Archive size={18} />
              <span className="hidden sm:inline">{showArchived ? 'Hide Archived' : 'Show Archived'}</span>
              <span className="inline sm:hidden">{showArchived ? 'Hide' : 'Show'}</span>
            </button>
            <button
              onClick={() => setShowVelocity(!showVelocity)}
              className={`flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all active:scale-95 ${
                showVelocity ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Velocity</span>
            </button>
            {(currentUserRole === 'OWNER' || currentUserRole === 'ADMIN') && (
              <button
                onClick={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }}
                className="flex h-10 sm:h-11 items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-[#155DFC] px-3 sm:px-5 text-[12px] sm:text-[13px] font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-[#1149C9] transform active:scale-95 transition-all duration-200"
              >
                <Rocket size={15} />
                <span className="whitespace-nowrap">Create Sprint</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 custom-scrollbar touch-pan-y">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 pb-32 sm:pb-8">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => <div key={i} className="h-40 w-full animate-pulse rounded-2xl bg-white shadow-sm border border-slate-100" />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h3>
              <p className="text-slate-500 max-w-sm text-center mb-8 px-6">{error}</p>
              <button onClick={() => window.location.reload()} className="h-12 px-8 bg-slate-900 text-white rounded-xl font-bold text-[14px] hover:bg-slate-800 transition-all active:scale-95">Try Again</button>
            </div>
          ) : (
                        <>
              <motion.div layout className="space-y-8">
                <AnimatePresence initial={false}>
                  {filteredSprints.length > 0 ? (
                    filteredSprints.map((sprint) => (
                      <motion.div
                        key={sprint.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <BacklogCard
                          sprint={sprint}
                          projectId={projectId!}
                          projectKey={projectKey}
                          currentUserRole={currentUserRole}
                          availableSprintsForMove={sprints
                            .filter((s) => s.id !== sprint.id && s.status === 'NOT_STARTED')
                            .map((s) => ({ id: s.id, name: s.name }))}
                          onDropTask={moveTaskToSprint}
                          onCreateTask={createSprintTask}
                          onToggleTask={toggleTaskSelection}
                          onDeleteTask={(taskId, sprintId) => {
                            setSprints((prev) => prev.map((s) => s.id === sprintId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s));
                          }}
                          onSprintDeleted={handleSprintDeleted}
                          onStatusChange={handleTaskStatusChange}
                          onStoryPointsChange={updateTaskStoryPoints}
                          onAssignTask={(taskId, name, photo) => {
                            setSprints(prev => prev.map(s => ({
                              ...s,
                              tasks: s.tasks.map(t => t.id === taskId ? { ...t, assigneeName: name, assigneePhotoUrl: photo } : t)
                            })));
                          }}
                          onRenameTask={async (taskId, title) => {
                            try {
                              await tasksApi.update(taskId, { title });
                              setSprints(prev => prev.map(s => ({
                                ...s,
                                tasks: s.tasks.map(t => t.id === taskId ? { ...t, title } : t)
                              })));
                            } catch { toast('Failed to rename task', 'error'); }
                          }}
                          projectLabels={projectLabels}
                          onCreateLabel={handleCreateLabel}
                          onDueDateChange={handleTaskDueDateChange}
                          extraStatuses={sprint.status === 'ACTIVE' ? activeBoardStatuses : []}
                          existingSprintNames={sprints.map((s) => s.name)}
                        />
                      </motion.div>
                    ))
                  ) : !filters.search && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200"
                    >
                      <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mb-5"><Rocket size={32} /></div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">No Active Sprints</h3>
                      <p className="text-slate-500 text-[14px] mb-8">Create a sprint to start planning your development cycle.</p>
                      <button onClick={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }} className="h-11 px-6 bg-[#155DFC] text-white rounded-xl font-bold text-[13px] hover:bg-[#1149C9] shadow-md shadow-blue-500/10 transition-all">Create First Sprint</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div layout className="mt-8">
                <ProductBacklogSection
                  tasks={filteredProductTasks}
                  projectId={projectId!}
                  projectKey={projectKey}
                  sprintCount={sprints.length}
                  currentUserRole={currentUserRole}
                  onToggleTask={toggleTaskSelection}
                  onStoryPointsChange={updateTaskStoryPoints}
                  onCreateTask={createTask}
                  onDeleteTask={(taskId) => { setProductTasks((prev) => prev.filter((t) => t.id !== taskId)); }}
                  onCreateSprint={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }}
                  onDropTask={moveTaskToBacklog}
                  onStatusChange={handleTaskStatusChange}
                  onDueDateChange={handleTaskDueDateChange}
                  onAssignTask={(taskId, assigneeName, assigneePhotoUrl) => {
                    setProductTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assigneeName, assigneePhotoUrl } : t)));
                  }}
                  onRenameTask={async (taskId, title) => {
                    try {
                      await tasksApi.update(taskId, { title });
                      setProductTasks(prev => prev.map(t => t.id === taskId ? { ...t, title } : t));
                    } catch { toast('Failed to rename task', 'error'); }
                  }}
                  externalShowCreateModal={showCreateTaskModal}
                  onCloseCreateModal={() => setShowCreateTaskModal(false)}
                  projectLabels={projectLabels}
                  onCreateLabel={handleCreateLabel}
                />
              </motion.div>

              <AnimatePresence>
                {showVelocity && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-8 overflow-hidden"
                  >
                    <VelocityChart sprints={velocityData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onMoveToSprint={handleBulkMoveToSprint}
          onMoveToBacklog={handleBulkMoveToBacklog}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
          onClear={handleClearSelection}
          sprints={sprints}
        />
      )}
    </div>
  );
}

export default function SprintBacklogPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading sprint backlog" subtitle="Preparing sprint and backlog tasks." variant="table" />}>
      <SprintBacklogPageContent />
    </Suspense>
  );
}
