'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Pause, Trash2, Loader2, Info, Calendar } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';

interface Task {
  id: number;
  title: string;
  recurrenceRule: string | null;
  recurrenceEnd: string | null;
  recurrenceActive: boolean;
  customInterval: number | null;
  recurrenceLimit: number | null;
  recurrenceCount: number;
  nextOccurrence: string | null;
  dueDate?: string | null;
}

interface RecurringSchedulesManagerProps {
  projectId: number;
}

export default function RecurringSchedulesManager({ projectId }: RecurringSchedulesManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const fetchRecurringTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/tasks/project/${projectId}/all`);
      const allTasks = (response.data || []) as Task[];
      // Filter only tasks that have a recurrence rule
      const recurring = allTasks.filter(t => t.recurrenceRule != null);
      setTasks(recurring);
    } catch (err) {
      console.error('Failed to load project recurring tasks:', err);
      toast('Failed to load recurring schedules', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => void fetchRecurringTasks());
  }, [fetchRecurringTasks]);

  const handleToggleActive = async (task: Task) => {
    setActionBusyId(task.id);
    const updatedActive = !task.recurrenceActive;
    try {
      await api.put(`/api/tasks/${task.id}`, {
        recurrenceActive: updatedActive,
      });
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, recurrenceActive: updatedActive } : t))
      );
      toast(
        `Schedule ${updatedActive ? 'resumed' : 'paused'} successfully`,
        'success'
      );
      // Re-fetch to get updated nextOccurrence calculated by backend
      await fetchRecurringTasks();
    } catch (err) {
      console.error('Failed to toggle active status:', err);
      toast('Failed to update recurrence status', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRemoveRecurrence = async (task: Task) => {
    if (!confirm('Are you sure you want to delete the recurring schedule for this task? It will convert back to a standard task.')) {
      return;
    }
    setActionBusyId(task.id);
    try {
      await api.put(`/api/tasks/${task.id}`, {
        recurrenceRule: null,
        recurrenceEnd: null,
        customInterval: null,
        recurrenceLimit: null,
      });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      toast('Recurring schedule removed successfully', 'success');
    } catch (err) {
      console.error('Failed to remove recurrence rule:', err);
      toast('Failed to delete recurring schedule', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  const getRuleLabel = (task: Task) => {
    if (!task.recurrenceRule) return '—';
    const rule = task.recurrenceRule.toUpperCase();
    if (rule.startsWith('CUSTOM_')) {
      const unit = rule.replace('CUSTOM_', '').toLowerCase();
      const interval = task.customInterval ?? 1;
      return `Every ${interval} ${interval === 1 ? unit.slice(0, -1) : unit}`;
    }
    return rule.charAt(0) + rule.slice(1).toLowerCase();
  };

  const getEndConditionLabel = (task: Task) => {
    if (task.recurrenceEnd) {
      return `Ends on ${new Date(task.recurrenceEnd + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }
    if (task.recurrenceLimit) {
      return `Limit: ${task.recurrenceLimit} occurrences`;
    }
    return 'Never ends';
  };

  return (
    <div className="space-y-4">
      {/* Informative Header Banner */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-cu-text-secondary leading-relaxed">
          <p className="font-semibold text-cu-text-primary mb-0.5">About Recurring Tasks</p>
          Recurring tasks act as templates. The system automatically spawns new task occurrences at the scheduled interval, copying details like description, priorities, labels, and assignees. Pausing a schedule prevents future occurrences from spawning until resumed.
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="animate-spin text-cu-primary" size={24} />
          <span className="text-xs text-cu-text-muted">Loading recurring schedules...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cu-border p-12 text-center flex flex-col items-center justify-center gap-3 bg-cu-bg-secondary/20">
          <div className="w-10 h-10 rounded-full bg-cu-bg-secondary flex items-center justify-center text-cu-text-muted">
            <RefreshCw size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-cu-text-primary">No recurring schedules</p>
            <p className="text-xs text-cu-text-secondary mt-1 max-w-sm mx-auto">
              Create a recurring schedule from the recurrence editor in a task&apos;s sidebar to automate task creation.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-cu-border rounded-xl bg-cu-bg overflow-hidden shadow-cu-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cu-border bg-cu-bg-secondary/40 text-[10px] font-bold text-cu-text-secondary uppercase tracking-wider">
                  <th className="px-5 py-3.5">Template Task</th>
                  <th className="px-5 py-3.5">Schedule</th>
                  <th className="px-5 py-3.5">Next Occurrence</th>
                  <th className="px-5 py-3.5">End Condition</th>
                  <th className="px-5 py-3.5 text-center">Spawned</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cu-border">
                {tasks.map(task => {
                  const isBusy = actionBusyId === task.id;
                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-cu-hover/40 transition-colors text-xs text-cu-text-primary ${
                        !task.recurrenceActive ? 'bg-amber-500/[0.01]' : ''
                      }`}
                    >
                      {/* Title */}
                      <td className="px-5 py-4 min-w-[200px]">
                        <div className="font-semibold truncate max-w-xs" title={task.title}>
                          {task.title}
                        </div>
                        <div className="text-[10px] text-cu-text-muted font-mono mt-0.5">
                          #{task.id}
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20 uppercase tracking-wide text-[10px]">
                          <RefreshCw size={11} className="animate-spin-slow" />
                          {getRuleLabel(task)}
                        </span>
                      </td>

                      {/* Next Occurrence */}
                      <td className="px-5 py-4">
                        {task.recurrenceActive ? (
                          task.nextOccurrence ? (
                            <div className="flex items-center gap-1.5 font-medium text-cu-text-primary">
                              <Calendar size={13} className="text-cu-text-muted" />
                              {new Date(task.nextOccurrence + 'T00:00:00').toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                          ) : (
                            <span className="text-cu-text-muted">—</span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                            <Pause size={10} /> Paused
                          </span>
                        )}
                      </td>

                      {/* End Condition */}
                      <td className="px-5 py-4 font-medium text-cu-text-secondary">
                        {getEndConditionLabel(task)}
                      </td>

                      {/* Spawned Count */}
                      <td className="px-5 py-4 text-center font-bold font-mono text-cu-text-primary">
                        {task.recurrenceCount}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                            task.recurrenceActive
                              ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20'
                          }`}
                        >
                          {task.recurrenceActive ? 'Active' : 'Paused'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pause/Resume Toggle */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleActive(task)}
                            className={`p-1.5 rounded-lg border transition-all duration-150 active:scale-95 ${
                              task.recurrenceActive
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-500 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500 hover:bg-emerald-500/20'
                            }`}
                            title={task.recurrenceActive ? 'Pause schedule' : 'Resume schedule'}
                          >
                            {isBusy ? (
                              <Loader2 size={13} className="animate-spin text-current" />
                            ) : task.recurrenceActive ? (
                              <Pause size={13} />
                            ) : (
                              <Play size={13} />
                            )}
                          </button>

                          {/* Delete schedule */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRemoveRecurrence(task)}
                            className="p-1.5 rounded-lg border border-cu-danger/25 bg-cu-danger/10 text-cu-danger hover:bg-cu-danger/20 transition-all duration-150 active:scale-95"
                            title="Remove recurring schedule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
