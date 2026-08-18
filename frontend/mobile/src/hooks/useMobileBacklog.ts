import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { createClientMutationId, taskService, sprintService } from '../services/task-service';
import { projectService } from '../services/project-service';
import { apiErrorMessage } from '../utils/apiError';

export type BacklogGroupBy = 'none' | 'status' | 'priority' | 'assignee';

export interface MobileLabel {
  id: number;
  name: string;
  color?: string | null;
}

export interface MobileTask {
  id: number;
  projectTaskNumber?: number | null;
  title: string;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  sprintId?: number | null;
  storyPoint?: number | null;
  assigneeName?: string | null;
  assigneePhotoUrl?: string | null;
  labels?: MobileLabel[];
  selected?: boolean;
}

export interface MobileSprint {
  id: number;
  name?: string;
  sprintName?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  goal?: string | null;
  tasks: MobileTask[];
}

export interface MobileBacklogFilters {
  search: string;
  status: string;
  priority: string;
  assignee: string;
  label: string;
  groupBy: BacklogGroupBy;
}

const DEFAULT_FILTERS: MobileBacklogFilters = {
  search: '',
  status: 'ALL',
  priority: 'ALL',
  assignee: 'ALL',
  label: 'ALL',
  groupBy: 'none',
};

const KANBAN_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_KANBAN_PAGE_SIZE = KANBAN_PAGE_SIZE_OPTIONS[0];

function normalizeTask(raw: MobileTask): MobileTask {
  return {
    ...raw,
    status: raw.status || 'TODO',
    priority: raw.priority || 'MEDIUM',
    storyPoint: raw.storyPoint ?? 0,
    sprintId: raw.sprintId ?? null,
    labels: raw.labels ?? [],
    selected: false,
  };
}

function sprintName(sprint: MobileSprint) {
  return sprint.sprintName || sprint.name || `Sprint #${sprint.id}`;
}

export function useMobileBacklog(projectId: number) {
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [sprints, setSprints] = useState<MobileSprint[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [filters, setFilters] = useState<MobileBacklogFilters>(DEFAULT_FILTERS);
  const [kanbanCurrentPage, setKanbanCurrentPage] = useState(1);
  const [kanbanPageSize, setKanbanPageSize] = useState<number>(DEFAULT_KANBAN_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklog = useCallback(async (background = false) => {
    if (!projectId) return;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [tasksData, sprintsData, projectData, membersData] = await Promise.all([
        taskService.listAllByProject(projectId),
        sprintService.listByProject(projectId).catch(() => []),
        projectService.get(projectId).catch(() => null),
        projectService.getMembers(projectId).catch(() => []),
      ]);

      const normalizedTasks = Array.isArray(tasksData)
        ? (tasksData as MobileTask[]).map(normalizeTask)
        : [];
      const rawSprints = Array.isArray(sprintsData) ? sprintsData as MobileSprint[] : [];

      const tasksBySprint = new Map<number, MobileTask[]>();
      normalizedTasks.forEach((task) => {
        if (!task.sprintId) return;
        if (!tasksBySprint.has(task.sprintId)) tasksBySprint.set(task.sprintId, []);
        tasksBySprint.get(task.sprintId)!.push(task);
      });

      const parsedMembers = (Array.isArray(membersData) ? membersData : []).map((m: any) => {
        const userId = m.user?.userId ?? m.userId ?? m.id ?? 0;
        const name = m.name || m.user?.fullName || m.user?.username || `Member ${userId}`;
        const profilePicUrl = m.user?.profilePicUrl ?? m.profilePicUrl ?? null;
        return {
          id: m.id ?? userId,
          userId,
          name,
          role: m.role ?? null,
          profilePicUrl,
          currentUser: m.currentUser || m.me || false,
        };
      }).filter((m) => m.userId > 0);
      setTasks(normalizedTasks);
      setSprints(rawSprints.map((sprint) => ({
        ...sprint,
        tasks: tasksBySprint.get(sprint.id) ?? [],
      })));
      setMembers(parsedMembers);
      setProjectKey(projectData?.projectKey || projectData?.key || '');

      const role = parsedMembers.find((member: any) => member.currentUser)?.role;
      if (role) setCurrentUserRole(role);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load backlog. Pull down to retry.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchBacklog(false);
  }, [fetchBacklog]);

  const allAssigneeNames = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.assigneeName?.trim() && task.assigneeName !== 'Unassigned') names.add(task.assigneeName.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const allLabels = useMemo(() => {
    const byId = new Map<number, MobileLabel>();
    tasks.forEach((task) => {
      task.labels?.forEach((label) => {
        byId.set(label.id, label);
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const applyFilters = useCallback((source: MobileTask[]) => {
    const term = filters.search.trim().toLowerCase();
    return source.filter((task) => {
      if (term) {
        const matches = [
          task.title,
          task.assigneeName || '',
          task.priority || '',
          task.status || '',
          `tsk-${task.projectTaskNumber ?? task.id}`,
          ...(task.labels || []).map((label) => label.name),
        ].some((value) => value.toLowerCase().includes(term));
        if (!matches) return false;
      }
      if (filters.status !== 'ALL' && (task.status || 'TODO') !== filters.status) return false;
      if (filters.priority !== 'ALL' && (task.priority || 'MEDIUM') !== filters.priority) return false;
      if (filters.assignee !== 'ALL' && (task.assigneeName || 'Unassigned') !== filters.assignee) return false;
      if (filters.label !== 'ALL' && !task.labels?.some((label) => String(label.id) === filters.label)) return false;
      return true;
    });
  }, [filters]);

  const productTasks = useMemo(
    () => tasks.filter((task) => !task.sprintId),
    [tasks]
  );

  const filteredProductTasks = useMemo(
    () => applyFilters(productTasks),
    [applyFilters, productTasks]
  );

  const filteredSprints = useMemo(
    () => sprints
      .filter((sprint) => sprint.status !== 'COMPLETED')
      .map((sprint) => ({ ...sprint, tasks: applyFilters(sprint.tasks) })),
    [applyFilters, sprints]
  );

  const groupedProductTasks = useMemo(() => {
    const groupBy = filters.groupBy;
    if (groupBy === 'none') return [{ label: 'Backlog', tasks: filteredProductTasks }];

    const groups: Record<string, MobileTask[]> = {};
    filteredProductTasks.forEach((task) => {
      const key = groupBy === 'status'
        ? (task.status || 'TODO').replace(/_/g, ' ')
        : groupBy === 'priority'
          ? task.priority || 'NONE'
          : task.assigneeName || 'Unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    return Object.entries(groups).map(([label, grouped]) => ({ label, tasks: grouped }));
  }, [filteredProductTasks, filters.groupBy]);

  useEffect(() => {
    setKanbanCurrentPage(1);
  }, [filters.search, filters.status, filters.priority, filters.assignee, filters.label, filters.groupBy]);

  const kanbanPagination = useMemo(() => {
    const totalItems = filteredProductTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / kanbanPageSize));
    const currentPage = Math.min(Math.max(1, kanbanCurrentPage), totalPages);
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * kanbanPageSize;
    const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + kanbanPageSize, totalItems);
    const pageItems = filteredProductTasks.slice(startIndex, endIndex);

    const groupedTasks = (() => {
      const groupBy = filters.groupBy;
      if (groupBy === 'none') return [{ label: 'Backlog', tasks: pageItems }];

      const groups: Record<string, MobileTask[]> = {};
      pageItems.forEach((task) => {
        const key = groupBy === 'status'
          ? (task.status || 'TODO').replace(/_/g, ' ')
          : groupBy === 'priority'
            ? task.priority || 'NONE'
            : task.assigneeName || 'Unassigned';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
      return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }));
    })();

    return {
      totalItems,
      totalPages,
      currentPage,
      pageSize: kanbanPageSize,
      startIndex,
      endIndex,
      pageItems,
      groupedTasks,
      pageSizeOptions: KANBAN_PAGE_SIZE_OPTIONS,
      setCurrentPage: (page: number) => {
        const safe = Math.min(Math.max(1, page), totalPages);
        setKanbanCurrentPage(safe);
      },
      setPageSize: (size: number) => {
        setKanbanPageSize(size);
        setKanbanCurrentPage(1);
      },
    };
  }, [filteredProductTasks, filters.groupBy, kanbanCurrentPage, kanbanPageSize]);

  useEffect(() => {
    if (kanbanCurrentPage > kanbanPagination.totalPages) {
      setKanbanCurrentPage(kanbanPagination.totalPages);
    }
  }, [kanbanCurrentPage, kanbanPagination.totalPages]);

  const selectedIds = useMemo(
    () => tasks.filter((task) => task.selected).map((task) => task.id),
    [tasks]
  );

  const selectedCount = selectedIds.length;

  const clearSelection = useCallback(() => {
    setTasks((current) => current.map((task) => ({ ...task, selected: false })));
  }, []);

  const toggleTaskSelection = useCallback((taskId: number) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, selected: !task.selected } : task
    )));
  }, []);

  const createTask = useCallback(async (title: string, sprintId?: number | null) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      await taskService.create({
        projectId,
        title: cleanTitle,
        clientMutationId: createClientMutationId(),
        sprintId: sprintId ?? undefined,
        priority: 'MEDIUM',
        storyPoint: 0,
      });
      await fetchBacklog(true);
    } catch (err) {
      Alert.alert('Task not created', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, projectId]);

  const createSprint = useCallback(async (name?: string) => {
    const fallback = projectKey ? `${projectKey} Sprint ${sprints.length + 1}` : `Sprint ${sprints.length + 1}`;
    const cleanName = (name || fallback).trim();
    try {
      await sprintService.create({ proId: projectId, name: cleanName });
      await fetchBacklog(true);
    } catch (err) {
      Alert.alert('Sprint not created', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, projectId, projectKey, sprints.length]);

  const updateStatus = useCallback(async (taskId: number, status: string) => {
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.map((task) => task.id === taskId ? { ...task, status } : task)
    })));
    try {
      await taskService.updateStatus(taskId, status);
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Status not updated', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, tasks, sprints]);

  const updateStoryPoints = useCallback(async (taskId: number, storyPoint: number) => {
    const value = Math.max(0, Number.isNaN(storyPoint) ? 0 : storyPoint);
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, storyPoint: value } : task));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.map((task) => task.id === taskId ? { ...task, storyPoint: value } : task)
    })));
    try {
      await taskService.update(taskId, { storyPoint: value });
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Points not updated', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, tasks, sprints]);

  const moveTaskToSprint = useCallback(async (taskId: number, sprintId: number | null) => {
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, sprintId, selected: false } : task));
    setSprints((current) => {
      const taskToMove = tasks.find((t) => t.id === taskId);
      if (!taskToMove) return current;
      const updatedTask = { ...taskToMove, sprintId, selected: false };
      return current.map((sprint) => {
        let sprintTasks = sprint.tasks.filter((t) => t.id !== taskId);
        if (sprint.id === sprintId) {
          sprintTasks = [...sprintTasks, updatedTask];
        }
        return { ...sprint, tasks: sprintTasks };
      });
    });
    try {
      await taskService.update(taskId, { sprintId });
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Task not moved', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, tasks, sprints]);

  const deleteTask = useCallback(async (taskId: number) => {
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.filter((task) => task.id !== taskId)
    })));
    try {
      await taskService.delete(taskId);
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Delete failed', apiErrorMessage(err, 'Only Project Owners or Admins can delete tasks.'));
    }
  }, [fetchBacklog, tasks, sprints]);

  const bulkStatus = useCallback(async (status: string) => {
    if (!selectedIds.length) return;
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => selectedIds.includes(task.id) ? { ...task, status, selected: false } : task));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.map((task) => selectedIds.includes(task.id) ? { ...task, status, selected: false } : task)
    })));
    try {
      await taskService.bulkUpdateStatus({ taskIds: selectedIds, status });
      clearSelection();
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Bulk update failed', apiErrorMessage(err, 'Please try again.'));
    }
  }, [clearSelection, fetchBacklog, selectedIds, tasks, sprints]);

  const bulkDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.filter((task) => !selectedIds.includes(task.id)));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.filter((task) => !selectedIds.includes(task.id))
    })));
    try {
      await taskService.bulkDelete({ taskIds: selectedIds });
      clearSelection();
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Bulk delete failed', apiErrorMessage(err, 'Only Project Owners or Admins can delete tasks.'));
    }
  }, [clearSelection, fetchBacklog, selectedIds, tasks, sprints]);

  const bulkMoveToSprint = useCallback(async (sprintId: number | null) => {
    if (!selectedIds.length) return;
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => selectedIds.includes(task.id) ? { ...task, sprintId, selected: false } : task));
    setSprints((current) => {
      const movedTasks = tasks.filter((t) => selectedIds.includes(t.id)).map((t) => ({ ...t, sprintId, selected: false }));
      return current.map((sprint) => {
        let sprintTasks = sprint.tasks.filter((t) => !selectedIds.includes(t.id));
        if (sprint.id === sprintId) {
          sprintTasks = [...sprintTasks, ...movedTasks];
        }
        return { ...sprint, tasks: sprintTasks };
      });
    });
    try {
      await Promise.all(selectedIds.map((taskId) => taskService.update(taskId, { sprintId })));
      clearSelection();
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Bulk move failed', apiErrorMessage(err, 'Please try again.'));
    }
  }, [clearSelection, fetchBacklog, selectedIds, tasks, sprints]);

  const stats = useMemo(() => {
    const visible = [...filteredProductTasks, ...filteredSprints.flatMap((sprint) => sprint.tasks)];
    const total = visible.length;
    const done = visible.filter((task) => task.status === 'DONE').length;
    const points = visible.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
    return { total, done, points, sprints: filteredSprints.length };
  }, [filteredProductTasks, filteredSprints]);

  const assignTask = useCallback(async (taskId: number, userId: number | null) => {
    const previousTasks = tasks;
    const previousSprints = sprints;
    const memberName = userId ? members.find((m) => m.userId === userId)?.name ?? 'Assigned' : 'Unassigned';
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, assigneeName: memberName } : task));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.map((task) => task.id === taskId ? { ...task, assigneeName: memberName } : task)
    })));
    try {
      if (userId === null) {
        await taskService.unassignTask(taskId);
      } else {
        await taskService.assignTaskSingle(taskId, userId);
      }
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Assignment failed', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, tasks, sprints, members]);

  const updateTaskDueDate = useCallback(async (taskId: number, dueDate: string | null) => {
    const previousTasks = tasks;
    const previousSprints = sprints;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, dueDate } : task));
    setSprints((current) => current.map((sprint) => ({
      ...sprint,
      tasks: sprint.tasks.map((task) => task.id === taskId ? { ...task, dueDate } : task)
    })));
    try {
      await taskService.updateDates(taskId, { dueDate, startDate: null });
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Date update failed', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, tasks, sprints]);

  const reorderTasks = useCallback(async (sprintId: number | null, orderedTaskIds: number[]) => {
    const previousTasks = tasks;
    const previousSprints = sprints;

    setTasks((current) => {
      const taskMap = new Map(current.map((t) => [t.id, t]));
      const otherTasks = current.filter((t) => t.sprintId !== sprintId);
      const reordered = orderedTaskIds
        .map((id) => {
          const task = taskMap.get(id);
          if (task) {
            return { ...task, sprintId };
          }
          return null;
        })
        .filter(Boolean) as MobileTask[];

      return [...otherTasks, ...reordered];
    });

    setSprints((current) => current.map((sprint) => {
      if (sprint.id === sprintId) {
        const taskMap = new Map(sprint.tasks.map((t) => [t.id, t]));
        const reordered = orderedTaskIds
          .map((id) => {
            const task = taskMap.get(id);
            if (task) {
              return { ...task, sprintId };
            }
            return null;
          })
          .filter(Boolean) as MobileTask[];
        return { ...sprint, tasks: reordered };
      }
      if (sprint.id !== sprintId && sprint.tasks.some((t) => orderedTaskIds.includes(t.id))) {
        return { ...sprint, tasks: sprint.tasks.filter((t) => !orderedTaskIds.includes(t.id)) };
      }
      return sprint;
    }));

    try {
      await taskService.reorderTasks({
        projectId,
        sprintId,
        orderedTaskIds,
      });
      await fetchBacklog(true);
    } catch (err) {
      setTasks(previousTasks);
      setSprints(previousSprints);
      Alert.alert('Reordering failed', apiErrorMessage(err, 'Please try again.'));
    }
  }, [fetchBacklog, projectId, tasks, sprints]);

  return {
    tasks,
    sprints,
    members,
    filteredSprints,
    filteredProductTasks,
    groupedProductTasks,
    kanbanPagination,
    allAssigneeNames,
    allLabels,
    currentUserRole,
    filters,
    setFilters,
    loading,
    refreshing,
    error,
    stats,
    selectedCount,
    selectedIds,
    refresh: () => fetchBacklog(true),
    clearSelection,
    toggleTaskSelection,
    createTask,
    createSprint,
    updateStatus,
    updateStoryPoints,
    moveTaskToSprint,
    deleteTask,
    bulkStatus,
    bulkDelete,
    bulkMoveToSprint,
    sprintName,
    assignTask,
    updateTaskDueDate,
    reorderTasks,
  };
}
