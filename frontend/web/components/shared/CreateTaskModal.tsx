'use client';

import React, { useEffect, useState } from 'react';
import { Hash, Plus, User, X } from 'lucide-react';
import LabelPicker from '@/components/shared/LabelPicker';
import type { Label } from '@/types';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';
import { useProjectAssigneeOptions } from '@/hooks/projects/useProjectAssigneeOptions';
import OverlayPortal from '@/components/ui/OverlayPortal';
import { formatLocalDate } from '@/lib/date-format';

export interface CreateTaskData {
  title: string;
  status?: string;
  priority: string;
  assigneeId?: number;
  assigneeIds?: number[];
  storyPoint?: number;
  labelIds?: number[];
  dueDate?: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: CreateTaskData) => Promise<void> | void;
  projectId: number;
  initialDueDate?: string;
  minDate?: string | null;
  maxDate?: string | null;
  showStoryPoints?: boolean;
  disablePastDueDates?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'bg-cu-success/10 text-cu-success border-cu-success/30' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-cu-warning/10 text-cu-warning border-cu-warning/30' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-cu-danger/10 text-cu-danger border-cu-danger/30' },
];

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21];

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  projectId,
  initialDueDate,
  minDate,
  maxDate,
  showStoryPoints = true,
  disablePastDueDates = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [titleLength, setTitleLength] = useState(0);
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState<number | ''>('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [storyPoint, setStoryPoint] = useState(0);
  const [dueDate, setDueDate] = useState(initialDueDate ?? '');
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const todayDateKey = formatLocalDate(new Date());
  const effectiveMinDate = disablePastDueDates
    ? (minDate && minDate > todayDateKey ? minDate : todayDateKey)
    : minDate;
  const { statuses } = useProjectStatuses(projectId);
  const {
    members: teamMembers,
    loadingMembers,
    membersError,
    retryMembers,
  } = useProjectAssigneeOptions(isOpen ? projectId : null);

  useEffect(() => {
    if (statuses.length > 0 && status === 'TODO') {
      queueMicrotask(() => setStatus(statuses[0].status));
    }
  }, [statuses, status]);

  const resetForm = () => {
    setTitle('');
    setTitleLength(0);
    if (statuses.length > 0) setStatus(statuses[0].status);
    else setStatus('TODO');
    setPriority('MEDIUM');
    setAssignee('');
    setSelectedAssigneeIds([]);
    setStoryPoint(0);
    setDueDate(initialDueDate ?? '');
    setSelectedLabels([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    if (dueDate) {
      if (disablePastDueDates && dueDate < todayDateKey) {
        setError('Due date cannot be in the past.');
        return;
      }
      if (minDate && dueDate < minDate) {
        setError('Task date cannot be before the sprint start date.');
        return;
      }
      if (maxDate && dueDate > maxDate) {
        setError('Task date cannot be after the sprint end date.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const finalAssigneeIds = selectedAssigneeIds.length > 0
        ? selectedAssigneeIds
        : (assignee ? [Number(assignee)] : []);
      const taskData: CreateTaskData = {
        title: title.trim(),
        status,
        priority,
        assigneeId: finalAssigneeIds.length > 0 ? finalAssigneeIds[0] : undefined,
        assigneeIds: finalAssigneeIds.length > 0 ? finalAssigneeIds : undefined,
        labelIds: selectedLabels.map((l) => l.id),
        dueDate: dueDate || undefined,
      };
      if (showStoryPoints) taskData.storyPoint = storyPoint;

      const result = onCreateTask(taskData);
      // Optimistic coordinators return immediately and own remote error
      // reporting. Legacy async callbacks are still supported.
      if (result && typeof result.then === 'function') await result;
      resetForm();
      onClose();
    } catch {
      setError('Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 bg-black/50 z-[var(--cu-z-modal)] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-cu-bg rounded-2xl shadow-cu-xl border border-cu-border max-w-lg w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
          {/* Header (Pinned) */}
          <div className="shrink-0 bg-cu-primary px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">Create Task</h2>
              </div>
              <button
                type="button"
                onClick={() => { resetForm(); onClose(); }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-cu-text-primary">TASK TITLE</label>
                <input
                  type="text"
                  maxLength={255}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleLength(e.target.value.length);
                  }}
                  placeholder="e.g. Design new landing page"
                  className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary focus:ring-2 focus:ring-cu-primary/20 focus:outline-none transition-all"
                  autoFocus
                />
                {titleLength > 200 && (
                  <p className="text-xs text-amber-500 mt-1">
                    {255 - titleLength} characters remaining
                  </p>
                )}
                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-cu-text-primary">STATUS</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-secondary focus:ring-2 focus:ring-cu-primary/20 focus:outline-none transition-all appearance-none"
                >
                  {statuses.map((s) => (
                    <option key={s.status} value={s.status}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-cu-text-primary">PRIORITY</label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-bold transition-all ${
                        priority === opt.value
                          ? `${opt.color} ring-2 ring-[#155DFC]/30`
                          : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:bg-cu-bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {showStoryPoints && (
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
                    <Hash size={14} className="text-cu-text-muted" /> STORY POINTS
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {FIBONACCI.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setStoryPoint(pt)}
                        className={`h-8 w-8 rounded-lg border text-[12px] font-bold transition-all ${
                          storyPoint === pt
                            ? 'bg-cu-primary text-white border-cu-primary'
                            : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:bg-cu-bg-secondary'
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
                    <User size={14} className="text-cu-text-muted" /> ASSIGNEES
                  </label>
                  {selectedAssigneeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssigneeIds([]);
                        setAssignee('');
                      }}
                      className="text-xs text-cu-text-muted hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {selectedAssigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-cu-bg-secondary border border-cu-border rounded-xl">
                    {selectedAssigneeIds.map((id) => {
                      const member = teamMembers.find((m) => m.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cu-bg border border-cu-border text-xs font-medium text-cu-text-primary shadow-xs"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cu-primary/10 text-[9px] font-bold text-cu-primary">
                            {member?.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </span>
                          <span className="truncate max-w-[120px]">{member?.name ?? `Member #${id}`}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssigneeIds((prev) => {
                                const next = prev.filter((item) => item !== id);
                                setAssignee(next.length > 0 ? next[0] : '');
                                return next;
                              });
                            }}
                            className="text-cu-text-muted hover:text-red-500 rounded p-0.5 transition-colors"
                            aria-label={`Remove ${member?.name ?? id}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    if (val !== null) {
                      setSelectedAssigneeIds((prev) => {
                        const exists = prev.includes(val);
                        const next = exists ? prev.filter((id) => id !== val) : [...prev, val];
                        setAssignee(next.length > 0 ? next[0] : '');
                        return next;
                      });
                    }
                  }}
                  className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-secondary focus:ring-2 focus:ring-cu-primary/20 focus:outline-none transition-all appearance-none cursor-pointer"
                  disabled={loadingMembers}
                >
                  <option value="">
                    {loadingMembers
                      ? 'Loading assignees...'
                      : selectedAssigneeIds.length > 0
                      ? '+ Add / toggle another assignee'
                      : 'Select Assignees (optional)'}
                  </option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {selectedAssigneeIds.includes(m.id) ? `✓ ${m.name}` : m.name}
                    </option>
                  ))}
                </select>
                {loadingMembers && (
                  <div className="h-2 w-32 animate-pulse rounded-full bg-cu-border" aria-label="Loading assignees" />
                )}
                {membersError && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-500">
                    <p className="font-semibold">{membersError}</p>
                    <button
                      type="button"
                      onClick={() => void retryMembers()}
                      className="mt-2 font-bold text-red-600 underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-cu-text-primary">LABELS</label>
                <LabelPicker
                  projectId={projectId}
                  selectedLabels={selectedLabels}
                  onChange={setSelectedLabels}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-cu-text-primary">DUE DATE (optional)</label>
                <input
                  type="date"
                  aria-label="Due date"
                  min={effectiveMinDate || undefined}
                  max={maxDate || undefined}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-secondary focus:ring-2 focus:ring-cu-primary/20 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Actions (Pinned Footer) */}
            <div className="shrink-0 px-6 py-4 bg-cu-bg-secondary border-t border-cu-border flex gap-3">
              <button
                type="button"
                onClick={() => { resetForm(); onClose(); }}
                className="flex-1 px-4 py-2.5 border border-cu-border text-cu-text-secondary rounded-xl font-bold text-sm hover:bg-cu-bg-tertiary transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-cu-primary text-white rounded-xl font-bold text-sm hover:bg-cu-primary-hover shadow-cu-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </OverlayPortal>
  );
}
