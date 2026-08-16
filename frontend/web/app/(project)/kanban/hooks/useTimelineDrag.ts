import { useState, useCallback, useEffect } from 'react';
import { Task } from '../types';
import { format, addDays } from 'date-fns';
import { updateTaskDates } from '../api';
import { toast } from '@/components/ui';
import {
  applyTaskMutation,
  createMutationId,
  isLatestTaskMutation,
  publishTaskMutation,
  revalidateTaskDependents,
} from '@/lib/task-cache';

interface TimelineTaskLike {
  id: number;
  startDateObj: Date;
  dueDateObj: Date;
  milestoneId?: number;
  projectId?: number;
}

export type TimelineDragType = 'move' | 'resize-left' | 'resize-right';

export function useTimelineDrag(
  dayColumnWidth: number,
  milestones: Array<{ id: number; name: string; dueDate?: string }>,
  onTaskUpdated?: (taskId: number, updates: Partial<Task>) => void,
  setLocalTasks?: React.Dispatch<React.SetStateAction<Task[]>>,
) {
  const [activeDrag, setActiveDrag] = useState<{
    taskId: number; type: TimelineDragType; startX: number; origStart: Date; origDue: Date; milestoneId?: number; projectId?: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeDrag) return;
    const deltaPx = e.clientX - activeDrag.startX;
    setDragOffset(Math.round(deltaPx / dayColumnWidth));
  }, [activeDrag, dayColumnWidth]);

  const handleMouseUp = useCallback(async () => {
    if (!activeDrag || dragOffset === 0) {
      setActiveDrag(null);
      setDragOffset(0);
      return;
    }

    const { taskId, type, origStart, origDue, milestoneId, projectId } = activeDrag;
    let newStartDate: string | undefined;
    let newDueDate: string | undefined;

    if (type === 'move') {
      newStartDate = format(addDays(origStart, dragOffset), 'yyyy-MM-dd');
      newDueDate = format(addDays(origDue, dragOffset), 'yyyy-MM-dd');
    } else if (type === 'resize-right') {
      const newDue = addDays(origDue, dragOffset);
      if (newDue < origStart) { setActiveDrag(null); setDragOffset(0); return; }
      newDueDate = format(newDue, 'yyyy-MM-dd');
    } else {
      const newStart = addDays(origStart, dragOffset);
      if (newStart > origDue) { setActiveDrag(null); setDragOffset(0); return; }
      newStartDate = format(newStart, 'yyyy-MM-dd');
    }

    const updates: Partial<Task> = {};
    if (newStartDate) updates.startDate = newStartDate;
    if (newDueDate) updates.dueDate = newDueDate;
    const originalDates = { startDate: format(origStart, 'yyyy-MM-dd'), dueDate: format(origDue, 'yyyy-MM-dd') };
    const mutationId = createMutationId();

    if (milestoneId != null && updates.dueDate) {
      const linkedMilestone = milestones.find((milestone) => milestone.id === milestoneId);
      if (linkedMilestone?.dueDate && updates.dueDate > linkedMilestone.dueDate) {
        toast(`Task due date moved past milestone "${linkedMilestone.name}". Milestone date is unchanged.`, 'warning');
      }
    }

    setLocalTasks?.(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    onTaskUpdated?.(taskId, updates);
    if (projectId != null) {
      applyTaskMutation({
        operation: 'updated',
        projectId,
        taskId,
        mutationId,
        source: 'optimistic',
        patch: updates,
        occurredAt: new Date().toISOString(),
      });
    }
    setActiveDrag(null);
    setDragOffset(0);

    try {
      // Use the specialized dates endpoint to avoid 400 errors from missing required fields in PUT
      const updatedTask = await updateTaskDates(taskId, updates.startDate, updates.dueDate);
      setLocalTasks?.(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t));
      onTaskUpdated?.(taskId, updatedTask);
      if (projectId != null) {
        const committed = {
          operation: 'updated' as const,
          projectId,
          taskId,
          mutationId,
          source: 'http' as const,
          task: updatedTask,
          occurredAt: new Date().toISOString(),
        };
        applyTaskMutation(committed);
        publishTaskMutation(committed);
        void revalidateTaskDependents(projectId);
      }
      toast('Timeline dates updated.', 'success');
    } catch {
      setLocalTasks?.(prev => prev.map(t =>
        t.id === taskId ? { ...t, ...originalDates } : t
      ));
      onTaskUpdated?.(taskId, originalDates);
      if (projectId != null && isLatestTaskMutation(taskId, mutationId)) {
        applyTaskMutation({
          operation: 'updated',
          projectId,
          taskId,
          mutationId,
          source: 'rollback',
          patch: originalDates,
          occurredAt: new Date().toISOString(),
        });
      }
      toast('Could not save timeline dates. Reverted the task schedule.', 'error');
    }
  }, [activeDrag, dragOffset, milestones, onTaskUpdated, setLocalTasks]);

  useEffect(() => {
    if (!activeDrag) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, handleMouseMove, handleMouseUp]);

  const startDrag = useCallback((e: React.MouseEvent, task: TimelineTaskLike, type: TimelineDragType) => {
    e.preventDefault();
    setActiveDrag({
      taskId: task.id,
      type,
      startX: e.clientX,
      origStart: task.startDateObj,
      origDue: task.dueDateObj,
      milestoneId: task.milestoneId,
      projectId: task.projectId,
    });
    setDragOffset(0);
  }, []);

  return { activeDrag, dragOffset, startDrag };
}
