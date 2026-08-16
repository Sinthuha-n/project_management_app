import { useCallback, useState } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { sprintsApi } from '@/services/api-contract';
import { toast } from '@/components/ui';
import { normalizeApiError } from '@/lib/api-error';
import { buildSessionCacheKey, removeSessionCache } from '@/lib/session-cache';
import {
  bulkDeleteTasks,
  bulkUpdateTaskStatus,
  completeSprint,
  moveTaskToColumn,
  reorderSprintColumns,
  patchTaskDueDate,
  assignTaskSingle,
  assignTaskMultiple,
} from '../api';
import type { SprintboardTask, SprintboardFullResponse, Sprintboard } from '../types';
import type { SprintTeamMemberOption } from '../api';
import type { AvailableDestSprint } from '../components/CompleteSprintModal';
import { useTaskMutations } from '@/hooks/useTaskMutations';

// ── Types ────────────────────────────────────────────────────────────────────

type SprintSummary = { id: number; status: string; sprintName?: string };

interface UseSprintBoardActionsArgs {
  projectIdStr: string | null;
  allBoards: SprintboardFullResponse[];
  allActiveSprints: SprintSummary[];
  setAllBoards: React.Dispatch<React.SetStateAction<SprintboardFullResponse[]>>;
  selectedIdx: number;
  activeSprint: SprintSummary | null;
  sprintboard: SprintboardFullResponse | null;
  board: Sprintboard | null;
  teamMembers: SprintTeamMemberOption[];
  forceRefresh: () => void;
  applyOptimisticMove: (taskId: number, toStatus: string) => void;
  rollbackMove: () => { taskId: number; fromStatus: string; toStatus: string } | null;
  selectedTaskIds: Set<number>;
  clearSelection: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSprintBoardActions({
  projectIdStr,
  allBoards,
  allActiveSprints,
  setAllBoards,
  selectedIdx,
  activeSprint,
  sprintboard,
  board,
  teamMembers,
  forceRefresh,
  applyOptimisticMove,
  rollbackMove,
  selectedTaskIds,
  clearSelection,
}: UseSprintBoardActionsArgs) {
  const taskMutations = useTaskMutations(projectIdStr);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [sprintIdToComplete, setSprintIdToComplete] = useState<number | null>(null);
  const [completeDestination, setCompleteDestination] = useState<number | null>(null);
  const [availableDestSprints, setAvailableDestSprints] = useState<AvailableDestSprint[]>([]);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // Compute incomplete task count for a given sprint from the boards already loaded
  const getIncompleteCount = useCallback((sprintId: number): number => {
    const idx = allActiveSprints.findIndex((s) => s.id === sprintId);
    const b = allBoards[idx];
    if (!b) return 0;
    return b.columns
      .filter((col) => col.columnStatus !== 'DONE')
      .reduce((sum, col) => sum + col.tasks.length, 0);
  }, [allBoards, allActiveSprints]);

  const incompleteCount = sprintIdToComplete != null ? getIncompleteCount(sprintIdToComplete) : 0;

  // Open the complete-sprint modal: pre-select the sprint, default destination to backlog,
  // and fetch NOT_STARTED sprints for the destination dropdown.
  const openCompleteModal = useCallback(async (sprintId: number) => {
    setSprintIdToComplete(sprintId);
    setCompleteDestination(null); // default: backlog
    setShowCompleteConfirm(true);
    if (!projectIdStr) return;
    try {
      const res = await sprintsApi.listByProject(projectIdStr);
      const notStarted = (res as Array<{ id: number; name?: string; sprintName?: string; status: string }>)
        .filter((s) => s.status === 'NOT_STARTED' && s.id !== sprintId)
        .map((s) => ({ id: s.id, name: s.sprintName || s.name || `Sprint #${s.id}` }));
      setAvailableDestSprints(notStarted);
    } catch {
      setAvailableDestSprints([]);
    }
  }, [projectIdStr]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !board || !sprintboard) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // ── Column Reorder Handling ──────────────────────────────────────────────
    if (activeId.startsWith('column-')) {
      const activeColumnId = Number(activeId.replace('column-', ''));
      let overColumnId: number | null = null;
      if (overId.startsWith('column-')) {
        overColumnId = Number(overId.replace('column-', ''));
      } else {
        const matchedCol = board.columns.find((col) =>
          col.columnStatus === overId ||
          col.id === Number(overId) ||
          col.tasks.some((t) => String(t.taskId) === overId)
        );
        if (matchedCol) overColumnId = matchedCol.id;
      }

      if (overColumnId !== null && activeColumnId !== overColumnId) {
        const fromIndex = board.columns.findIndex((column) => column.id === activeColumnId);
        const toIndex = board.columns.findIndex((column) => column.id === overColumnId);
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          const reordered = arrayMove(board.columns, fromIndex, toIndex);
          setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : { ...entry, columns: reordered }));
          try {
            await reorderSprintColumns(sprintboard.id, reordered.map((column, index) => ({ id: column.id, position: index })));
          } catch {
            toast('Failed to reorder columns, refreshing board', 'error');
            forceRefresh();
          }
        }
      }
      return;
    }

    // ── Task Move Handling ───────────────────────────────────────────────────
    const taskId = parseInt(String(active.id), 10);
    const newStatus = String(over.id);
    const sourceColumn = board.columns.find((column) => column.tasks.some((task) => task.taskId === taskId));
    if (!sourceColumn || sourceColumn.columnStatus === newStatus) return;
    applyOptimisticMove(taskId, newStatus);
    setAllBoards((prev) => prev.map((entry, idx) => {
      if (idx !== selectedIdx) return entry;
      const taskToMove = entry.columns.flatMap((column) => column.tasks).find((task) => task.taskId === taskId);
      if (!taskToMove) return entry;
      return {
        ...entry,
        columns: entry.columns.map((column) => {
          if (column.columnStatus === sourceColumn.columnStatus) return { ...column, tasks: column.tasks.filter((task) => task.taskId !== taskId) };
          if (column.columnStatus === newStatus) return { ...column, tasks: [...column.tasks, { ...taskToMove, status: newStatus }] };
          return column;
        }),
      };
    }));
    try {
      await moveTaskToColumn(taskId, sprintboard.id, newStatus);
      const cacheKey = buildSessionCacheKey('sprint-board-v2', [projectIdStr]);
      if (cacheKey) removeSessionCache(cacheKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch { forceRefresh(); }
  };

  const handleInlineCreateTask = useCallback((title: string, status: string) => {
    if (!projectIdStr || !activeSprint) return;
    const result = taskMutations.create({ title, status, projectId: parseInt(projectIdStr, 10), sprintId: activeSprint.id, storyPoint: 0, priority: 'MEDIUM' });
    const toBoardTask = (task: typeof result.optimisticTask): SprintboardTask => ({
        taskId: task.id, projectTaskNumber: task.projectTaskNumber ?? task.id,
        title: task.title, storyPoint: task.storyPoint ?? 0, status: task.status,
        priority: task.priority ?? 'MEDIUM', assigneeName: task.assigneeName,
        assigneePhotoUrl: task.assigneePhotoUrl ?? undefined, updatedAt: task.updatedAt,
        attachmentCount: 0, commentCount: 0,
    });
    const optimistic = toBoardTask(result.optimisticTask);
    setAllBoards((prev) => prev.map((entry, idx) => idx === selectedIdx
        ? { ...entry, columns: entry.columns.map((col) => col.columnStatus === status ? { ...col, tasks: [...col.tasks, optimistic] } : col) }
        : entry));
    void result.completion.then((serverTask) => {
      const committed = toBoardTask(serverTask);
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
        ...entry,
        columns: entry.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) => task.taskId === optimistic.taskId ? committed : task),
        })),
      }));
    }).catch(() => setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((column) => ({ ...column, tasks: column.tasks.filter((task) => task.taskId !== optimistic.taskId) })),
    })));
  }, [projectIdStr, activeSprint, selectedIdx, setAllBoards, taskMutations]);

  const handleInlineDueDateChange = useCallback(async (taskId: number, dueDate: string | null) => {
    try {
      await patchTaskDueDate(taskId, dueDate);
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
        ...entry, columns: entry.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => task.taskId === taskId ? { ...task, dueDate: dueDate ?? undefined } : task) })),
      }));
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to update due date.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, forceRefresh, setAllBoards]);

  // Instant 0ms optimistic single assign
  const handleInlineAssignSingle = useCallback(async (taskId: number, userId: number) => {
    const selected = teamMembers.find((member) => member.userId === userId || member.id === userId);
    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) => {
          if (task.taskId !== taskId) return task;
          return {
            ...task,
            assigneeName: selected?.name,
            assigneePhotoUrl: selected?.photoUrl ?? undefined,
            assignees: selected ? [{
              memberId: selected.id,
              userId: selected.userId,
              name: selected.name,
              photoUrl: selected.photoUrl ?? undefined,
            }] : [],
          };
        }),
      })),
    }));

    try {
      await assignTaskSingle(taskId, userId);
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to update assignee.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, teamMembers, forceRefresh, setAllBoards]);

  // Instant 0ms optimistic multi assign
  const handleInlineAssignMultiple = useCallback(async (taskId: number, assigneeIds: number[]) => {
    const selectedMembers = teamMembers.filter((m) => assigneeIds.includes(m.userId ?? m.id));
    const firstMember = selectedMembers[0];
    const newAssignees = selectedMembers.map((m) => ({
      memberId: m.id,
      userId: m.userId,
      name: m.name,
      photoUrl: m.photoUrl ?? undefined,
    }));

    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) => {
          if (task.taskId !== taskId) return task;
          return {
            ...task,
            assigneeName: firstMember?.name,
            assigneePhotoUrl: firstMember?.photoUrl ?? undefined,
            assignees: newAssignees,
          };
        }),
      })),
    }));

    try {
      await assignTaskMultiple(taskId, assigneeIds);
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to update assignees.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, teamMembers, forceRefresh, setAllBoards]);

  // Task Rename
  const handleRenameTask = useCallback(async (taskId: number, newTitle: string) => {
    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) => t.taskId === taskId ? { ...t, title: newTitle } : t),
      })),
    }));
    try {
      const { renameSprintTask } = await import('../api');
      await renameSprintTask(taskId, newTitle);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to rename task.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, forceRefresh, setAllBoards]);

  // Task Delete
  const handleDeleteTask = useCallback(async (taskId: number) => {
    setAllBoards((prev) => prev.map((entry, idx) => {
      if (idx !== selectedIdx) return entry;
      return {
        ...entry,
        columns: entry.columns.map((col) => ({
          ...col,
          tasks: col.tasks.filter((t) => t.taskId !== taskId),
        })),
      };
    }));

    try {
      const { deleteSprintTask } = await import('../api');
      await deleteSprintTask(taskId);
      toast('Task deleted', 'success');
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to delete task.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, forceRefresh, setAllBoards]);

  // Column Rename
  const handleRenameColumn = useCallback(async (columnId: number, newName: string) => {
    if (!sprintboard) return;
    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((col) => col.id === columnId ? { ...col, columnName: newName } : col),
    }));
    try {
      const { updateSprintColumn } = await import('../api');
      await updateSprintColumn(sprintboard.id, columnId, { name: newName });
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to rename column.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, sprintboard, forceRefresh, setAllBoards]);

  // Column Change Color
  const handleChangeColumnColor = useCallback(async (columnId: number, color: string | null) => {
    if (!sprintboard) return;
    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.map((col) => col.id === columnId ? { ...col, color } : col),
    }));
    try {
      const { updateSprintColumn } = await import('../api');
      await updateSprintColumn(sprintboard.id, columnId, { color });
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to update column color.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, sprintboard, forceRefresh, setAllBoards]);

  // Column Delete
  const handleDeleteColumn = useCallback(async (columnId: number) => {
    if (!sprintboard) return;
    setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
      ...entry,
      columns: entry.columns.filter((col) => col.id !== columnId),
    }));
    try {
      const { deleteSprintColumn } = await import('../api');
      await deleteSprintColumn(sprintboard.id, columnId);
      toast('Column deleted', 'success');
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to delete column.'), 'error');
      forceRefresh();
    }
  }, [selectedIdx, sprintboard, forceRefresh, setAllBoards]);

  const handleCompleteSprint = async () => {
    if (!sprintIdToComplete) return;
    setIsUpdating(true);
    try {
      await completeSprint(sprintIdToComplete, completeDestination);
      setShowCompleteConfirm(false);
      setSuccessMsg('Sprint completed successfully!');
      setTimeout(() => setSuccessMsg(''), 1800);
      forceRefresh();
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to complete sprint.'), 'error');
    } finally { setIsUpdating(false); }
  };

  const finalizeAddColumn = async (name: string, status: string, color?: string) => {
    if (!sprintboard) return;
    setIsCreatingColumn(true);
    try {
      const { addColumn } = await import('../api');
      await addColumn(sprintboard.id, name, status, color);
      setSuccessMsg(`Column "${name}" added`);
      setTimeout(() => setSuccessMsg(''), 1500);
      setIsAddingColumn(false);
      setNewColumnName('');
      forceRefresh();
    } catch (err: unknown) {
      toast(normalizeApiError(err, 'Failed to add column.'), 'error');
    } finally { setIsCreatingColumn(false); }
  };

  const handleUndoMove = async () => {
    const snapshot = rollbackMove();
    if (!snapshot || !sprintboard) return;
    try { await moveTaskToColumn(snapshot.taskId, sprintboard.id, snapshot.fromStatus); forceRefresh(); }
    catch { toast('Failed to undo move', 'error'); forceRefresh(); }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedTaskIds.size === 0) return;
    setIsBulkApplying(true);
    try { await bulkUpdateTaskStatus(Array.from(selectedTaskIds), status); clearSelection(); forceRefresh(); }
    catch { toast('Bulk status update failed', 'error'); }
    finally { setIsBulkApplying(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    setIsBulkApplying(true);
    try { await bulkDeleteTasks(Array.from(selectedTaskIds)); clearSelection(); forceRefresh(); }
    catch { toast('Bulk delete failed', 'error'); }
    finally { setIsBulkApplying(false); }
  };

  return {
    isUpdating, successMsg,
    showCompleteConfirm, setShowCompleteConfirm,
    sprintIdToComplete, setSprintIdToComplete,
    completeDestination, setCompleteDestination,
    availableDestSprints,
    incompleteCount,
    openCompleteModal,
    isAddingColumn, setIsAddingColumn,
    newColumnName, setNewColumnName,
    isCreatingColumn, isBulkApplying,
    handleDragEnd,
    handleInlineCreateTask,
    handleInlineDueDateChange,
    handleInlineAssignSingle,
    handleInlineAssignMultiple,
    handleRenameTask,
    handleDeleteTask,
    handleRenameColumn,
    handleChangeColumnColor,
    handleDeleteColumn,
    handleCompleteSprint,
    finalizeAddColumn,
    handleUndoMove,
    handleBulkStatus,
    handleBulkDelete,
  };
}
