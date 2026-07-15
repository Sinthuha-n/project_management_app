'use client';

import { useState, useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, KanbanColumnConfig } from '../types';
import {
  moveKanbanTask,
  reorderKanbanColumns,
} from '../api';
import { toast } from '@/components/ui';
import { buildSessionCacheKey, setSessionCache } from '@/lib/session-cache';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import type { Task as CanonicalTask } from '@/types';

// Helper exported for unit testing: performs optimistic update and reverts on failure
export async function optimisticUpdateTaskStatusHelper(
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  taskId: number,
  newStatus: string,
  updateFn: (taskId: number, status: string, title?: string) => Promise<unknown>,
  title?: string,
) {
  const previous = tasks;
  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  try {
    await updateFn(taskId, newStatus, title);
    return { success: true };
  } catch (err) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: previous.find(p => p.id === taskId)?.status ?? t.status } : t));
    throw err;
  }
}

export function useKanbanActions(
  projectId: string | null,
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  columnConfigs: KanbanColumnConfig[],
  setColumnConfigs: React.Dispatch<React.SetStateAction<KanbanColumnConfig[]>>,
  forceRefresh: () => void,
  upsertTask: (t: Task) => void,
  patchTask: (id: number, patch: Partial<Task>) => void,
  removeTask: (id: number) => void,
  syncCache: (tasks: Task[]) => void,
) {
  const taskMutations = useTaskMutations(projectId);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<string>('TODO');
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Task drag-and-drop ────────────────────────────────────────────────────

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !projectId) return;

    const taskId = Number(active.id);
    const overId = String(over.id);

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const validStatuses = columnConfigs.map(c => c.status);

    // Determine target status: over.id can be a column status string or a card id
    let newStatus: string;
    if (validStatuses.includes(overId)) {
      newStatus = overId;
    } else {
      const overTask = tasks.find(t => t.id === Number(overId));
      if (!overTask) return;
      newStatus = overTask.status;
    }

    // Build the new ordered task list for the destination column.
    // We insert the dragged task at the position determined by the drop target.
    const destinationTasks = tasks
      .filter(t => t.status === newStatus && t.id !== taskId)
      .map(t => t);

    let insertIndex = destinationTasks.length;
    if (validStatuses.includes(overId)) {
      // Dropped onto the column itself — append at the end
      insertIndex = destinationTasks.length;
    } else {
      // Dropped onto another card — insert before that card
      const overIdx = destinationTasks.findIndex(t => t.id === Number(overId));
      if (overIdx >= 0) insertIndex = overIdx;
    }

    const reorderedColumn = [...destinationTasks];
    reorderedColumn.splice(insertIndex, 0, { ...task, status: newStatus });
    const orderedTaskIds = reorderedColumn.map(t => t.id);

    // For same-column reorder: check if order actually changed
    const previousColumnTasks = tasks.filter(t => t.status === newStatus);
    const previousIds = previousColumnTasks.map(t => t.id);
    const isStatusChange = task.status !== newStatus;
    const isReorder = orderedTaskIds.join(',') !== previousIds.join(',');
    if (!isStatusChange && !isReorder) return; // Nothing changed

    // Snapshot for rollback
    const previousTasks = tasks;

    // Optimistic local update
    setTasks(prev => {
      const withoutDragged = prev.filter(t => t.id !== taskId);
      const destCol = withoutDragged.filter(t => t.status === newStatus);
      const otherCols = withoutDragged.filter(t => t.status !== newStatus);

      const newDest = [...destCol];
      const dropIdx = validStatuses.includes(overId)
        ? newDest.length
        : Math.max(0, newDest.findIndex(t => t.id === Number(overId)));

      newDest.splice(dropIdx >= 0 ? dropIdx : newDest.length, 0, { ...task, status: newStatus });
      return [...otherCols, ...newDest];
    });

    setUpdatingTaskId(taskId);

    const attempt = async () => {
      try {
        const updatedTask = await taskMutations.move(
          taskId,
          { status: newStatus },
          () => moveKanbanTask({ projectId: Number(projectId), taskId, status: newStatus, orderedTaskIds }),
          task as unknown as CanonicalTask,
        );
        // Merge server-enriched fields (e.g. completedAt) into local state
        upsertTask(updatedTask);
        // Persist the updated order to the session cache
        setTasks(current => {
          syncCache(current);
          return current;
        });
      } catch (err) {
        // Rollback to the pre-drag snapshot
        setTasks(previousTasks);

        const retryFn = async () => {
          setUpdatingTaskId(taskId);
          try {
            const updatedTask = await taskMutations.move(
              taskId,
              { status: newStatus },
              () => moveKanbanTask({ projectId: Number(projectId), taskId, status: newStatus, orderedTaskIds }),
              task as unknown as CanonicalTask,
            );
            upsertTask(updatedTask);
            setTasks(current => { syncCache(current); return current; });
          } catch (e) {
            console.error('Retry failed:', e);
            toast('Retry failed. Please try again later.', 'error');
          } finally {
            setUpdatingTaskId(null);
          }
        };

        toast('Failed to move task. Retry?', 'error', 8000, 'Retry', retryFn);
        console.error('Error moving task:', err);
      } finally {
        setUpdatingTaskId(null);
      }
    };

    void attempt();
  }, [tasks, columnConfigs, setTasks, projectId, upsertTask, syncCache, taskMutations]);

  // ── Column reorder ────────────────────────────────────────────────────────

  const handleColumnDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnConfigs.findIndex(c => c.status === active.id);
    const newIndex = columnConfigs.findIndex(c => c.status === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(columnConfigs, oldIndex, newIndex);
    setColumnConfigs(newOrder);

    try {
      await reorderKanbanColumns(newOrder.map((col, i) => ({ id: col.id, position: i })));
    } catch (err) {
      console.error('Error reordering columns:', err);
      setColumnConfigs(columnConfigs);
    }
  }, [columnConfigs, setColumnConfigs]);

  // ── Open create modal (used by mobile FAB) ────────────────────────────────

  const handleOpenCreateModal = useCallback((status: string) => {
    setSelectedColumnStatus(status);
    setIsCreateModalOpen(true);
  }, []);

  // ── Create task via the board-local modal ─────────────────────────────────

  const handleCreateTask = useCallback((data: Partial<Task>) => {
    const title = data.title?.trim();
    if (!projectId || !title) return;
    const result = taskMutations.create({
        projectId: Number(projectId),
        title,
        status: selectedColumnStatus,
        priority: data.priority,
    });
    const optimistic = result.optimisticTask as unknown as Task;
    setTasks(prev => { const next = [...prev, optimistic]; syncCache(next); return next; });
    setIsCreateModalOpen(false);
    void result.completion.then((serverTask) => setTasks(prev => {
      const next = prev.map(task => task.id === optimistic.id ? serverTask as Task : task);
      syncCache(next); return next;
    })).catch(() => setTasks(prev => prev.filter(task => task.id !== optimistic.id)));
  }, [projectId, selectedColumnStatus, setTasks, syncCache, taskMutations]);

  // ── Inline create from column header ─────────────────────────────────────

  const handleAddTask = useCallback((title: string, status: string) => {
    if (!projectId || !title.trim()) return;
    const result = taskMutations.create({
        projectId: Number(projectId),
        title: title.trim(),
        status,
    });
    const optimistic = result.optimisticTask as unknown as Task;
    setTasks(prev => { const next = [...prev, optimistic]; syncCache(next); return next; });
    void result.completion.then((serverTask) => setTasks(prev => {
      const next = prev.map(task => task.id === optimistic.id ? serverTask as Task : task);
      syncCache(next); return next;
    })).catch(() => setTasks(prev => prev.filter(task => task.id !== optimistic.id)));
  }, [projectId, setTasks, syncCache, taskMutations]);

  // ── Inline update — used by KanbanCard's inline edit mode ────────────────

  const handleInlineUpdate = useCallback(async (taskId: number, updates: Partial<Task>) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;
    // Optimistic update
    patchTask(taskId, updates);
    try {
      await taskMutations.update(taskId, updates, currentTask as unknown as CanonicalTask);
      setTasks(current => { syncCache(current); return current; });
    } catch (err) {
      console.error('Error inline updating task:', err);
      // Revert the optimistic patch by forcing a refresh on error
      forceRefresh();
    }
  }, [patchTask, setTasks, syncCache, forceRefresh, taskMutations, tasks]);

  // ── Delete task ───────────────────────────────────────────────────────────

  const handleDeleteTask = useCallback(async (taskId: number) => {
    // Optimistic removal
    const previousTasks = tasks;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    removeTask(taskId);
    try {
      await taskMutations.delete(task as unknown as CanonicalTask);
      setTasks(current => { syncCache(current); return current; });
    } catch (err: unknown) {
      console.error('Error deleting task:', err);
      // Revert on failure
      setTasks(previousTasks);
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 400) {
        setToastMessage('⚠️ Delete failed: Only project owners/admins can delete tasks.');
      } else {
        setToastMessage('⚠️ Failed to delete task. Please try again.');
      }
      setTimeout(() => setToastMessage(null), 4000);
    }
  }, [tasks, removeTask, setTasks, syncCache, taskMutations]);

  // ── Complete all tasks ────────────────────────────────────────────────────

  const handleCompleteBoard = useCallback(async () => {
    const nonDone = tasks.filter(t => t.status !== 'DONE');
    if (nonDone.length === 0) {
      setToastMessage('All tasks are already done!');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setCompleteSuccess(false);
    try {
      // Optimistically flip all tasks to DONE
      setTasks(prev => {
        const next = prev.map(t => ({ ...t, status: 'DONE' }));
        syncCache(next);
        return next;
      });
      // Fire all status updates in parallel
      await Promise.all(nonDone.map(t => {
        // Use moveKanbanTask for consistency; orderedTaskIds is empty for bulk ops
        // to avoid rewriting order (we just update status)
        return moveKanbanTask({
          projectId: Number(projectId),
          taskId: t.id,
          status: 'DONE',
          orderedTaskIds: [],
        });
      }));
      setCompleteSuccess(true);
      setToastMessage(`Archived ${nonDone.length} task${nonDone.length !== 1 ? 's' : ''} to Done.`);
      setTimeout(() => {
        setCompleteSuccess(false);
        setToastMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Error completing board:', err);
      setToastMessage('Failed to complete board. Please try again.');
      setTimeout(() => setToastMessage(null), 3000);
      // Revert optimistic update on failure
      forceRefresh();
    }
  }, [tasks, setTasks, projectId, syncCache, forceRefresh]);

  // ── Column management ─────────────────────────────────────────────────────

  const handleColumnRenamed = useCallback((columnId: number, newName: string) => {
    setColumnConfigs(prev => prev.map(c => c.id === columnId ? { ...c, title: newName } : c));
  }, [setColumnConfigs]);

  const handleColumnSettingsChanged = useCallback(
    (columnId: number, settings: { color?: string; wipLimit?: number }) => {
      setColumnConfigs(prev => prev.map(c =>
        c.id === columnId
          ? {
              ...c,
              ...(settings.color !== undefined ? { color: settings.color } : {}),
              ...(settings.wipLimit !== undefined ? { wipLimit: settings.wipLimit } : {}),
            }
          : c
      ));
    },
    [setColumnConfigs]
  );

  const handleDeleteColumn = useCallback((columnId: number) => {
    setColumnConfigs(prev => prev.filter(c => c.id !== columnId));
  }, [setColumnConfigs]);

  return {
    updatingTaskId,
    isCreateModalOpen,
    setIsCreateModalOpen,
    selectedColumnStatus,
    completeSuccess,
    toastMessage,
    selectedTaskIdForModal,
    setSelectedTaskIdForModal,
    handleDragEnd,
    handleColumnDragEnd,
    handleAddTask,
    handleCreateTask,
    handleOpenCreateModal,
    handleInlineUpdate,
    handleDeleteTask,
    handleCompleteBoard,
    handleColumnRenamed,
    handleColumnSettingsChanged,
    handleDeleteColumn,
  };
}
