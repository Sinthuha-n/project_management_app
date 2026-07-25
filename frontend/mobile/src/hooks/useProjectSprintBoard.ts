import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientMutationId, taskService, sprintService, sprintboardService } from '../services/task-service';

export interface SprintSummary {
  id: number;
  name?: string;
  sprintName?: string;
  status?: string;
}

export interface SprintboardTask {
  taskId: number;
  projectTaskNumber?: number | null;
  title: string;
  storyPoint?: number | null;
  assigneeName?: string | null;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  labelName?: string | null;
  labelColor?: string | null;
}

export interface Sprintcolumn {
  id: number;
  position: number;
  columnName: string;
  columnStatus: string;
  tasks: SprintboardTask[];
}

export interface SprintboardStats {
  totalTasks: number;
  doneTasks: number;
  totalStoryPoints: number;
  doneStoryPoints: number;
  overdueTasks: number;
  unassignedTasks: number;
}

export interface Sprintboard {
  id: number;
  sprintId: number;
  sprintName: string;
  sprintStatus: string;
  stats?: SprintboardStats;
  columns: Sprintcolumn[];
}

const DEFAULT_COLUMNS: Sprintcolumn[] = [
  { id: 0, position: 0, columnName: 'To Do', columnStatus: 'TODO', tasks: [] },
  { id: 0, position: 1, columnName: 'In Progress', columnStatus: 'IN_PROGRESS', tasks: [] },
  { id: 0, position: 2, columnName: 'In Review', columnStatus: 'IN_REVIEW', tasks: [] },
  { id: 0, position: 3, columnName: 'Done', columnStatus: 'DONE', tasks: [] },
];

function normalizeColumns(columns?: Sprintcolumn[]) {
  const existing = [...(columns || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return existing.length ? existing : DEFAULT_COLUMNS;
}

export function useProjectSprintBoard(projectId: number) {
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [board, setBoard] = useState<Sprintboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  );

  const fetchBoard = useCallback(async (background = false, sprintIdOverride?: number | null) => {
    if (!projectId) return;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const sprintsData = await sprintService.listByProject(projectId);
      const sprintList = Array.isArray(sprintsData) ? sprintsData as SprintSummary[] : [];
      const activeSprint = sprintList.find((sprint) => sprint.status === 'ACTIVE') ?? sprintList[0] ?? null;
      const sprintId = sprintIdOverride ?? selectedSprintId ?? activeSprint?.id ?? null;

      setSprints(sprintList);
      setSelectedSprintId(sprintId);

      if (!sprintId) {
        setBoard(null);
        return;
      }

      const boardData = await sprintboardService.getFull(sprintId);
      const raw = boardData as Sprintboard;
      setBoard({
        ...raw,
        columns: normalizeColumns(raw.columns),
      });
    } catch {
      setError('Failed to load sprint board. Pull down to retry.');
      setBoard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, selectedSprintId]);

  useEffect(() => {
    void fetchBoard(false);
  }, [fetchBoard]);

  const selectSprint = useCallback((sprintId: number) => {
    setSelectedSprintId(sprintId);
    void fetchBoard(false, sprintId);
  }, [fetchBoard]);

  const createTask = useCallback(async (title: string, status: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || !selectedSprintId) return;

    await taskService.create({
      projectId,
      sprintId: selectedSprintId,
      title: cleanTitle,
      clientMutationId: createClientMutationId(),
      status,
      priority: 'MEDIUM',
    });
    await fetchBoard(true, selectedSprintId);
  }, [fetchBoard, projectId, selectedSprintId]);

  const addColumn = useCallback(async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName || !board?.id) return;
    const status = cleanName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'CUSTOM';

    await sprintboardService.addColumn(board.id, {
      name: cleanName,
      status,
    });
    await fetchBoard(true, selectedSprintId);
  }, [board?.id, fetchBoard, selectedSprintId]);

  const deleteTask = useCallback(async (taskId: number) => {
    if (!selectedSprintId) return;
    await taskService.delete(taskId);
    await fetchBoard(true, selectedSprintId);
  }, [fetchBoard, selectedSprintId]);

  const updateTaskTitle = useCallback(async (taskId: number, title: string) => {
    if (!selectedSprintId) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    await taskService.update(taskId, { title: cleanTitle });
    await fetchBoard(true, selectedSprintId);
  }, [fetchBoard, selectedSprintId]);

  const deleteColumn = useCallback(async (columnId: number) => {
    if (!board?.id || !columnId || !selectedSprintId) return;
    await sprintboardService.deleteColumn(board.id, columnId);
    await fetchBoard(true, selectedSprintId);
  }, [board?.id, fetchBoard, selectedSprintId]);

  return {
    sprints,
    selectedSprint,
    selectedSprintId,
    board,
    loading,
    refreshing,
    error,
    refresh: () => fetchBoard(true),
    selectSprint,
    createTask,
    addColumn,
    deleteTask,
    updateTaskTitle,
    deleteColumn,
  };
}
