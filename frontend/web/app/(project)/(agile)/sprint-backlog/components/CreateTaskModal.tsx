'use client';

import React, { useState } from 'react';
import { X, Plus, User, Hash } from 'lucide-react';
import { useProjectAssigneeOptions } from '@/hooks/projects/useProjectAssigneeOptions';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    priority: string;
    assigneeId?: number;
    storyPoint: number;
  }) => Promise<void>;
  projectId: number;
}

const PRIORITY_OPTIONS = [
  { value: 'LOW',      label: 'Low',      color: 'bg-cu-success-light text-cu-success border-cu-success/30' },
  { value: 'MEDIUM',   label: 'Medium',   color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30' },
  { value: 'HIGH',     label: 'High',     color: 'bg-cu-danger-light text-cu-danger border-cu-danger/30' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-cu-danger-light text-cu-danger border-cu-danger/50' },
];

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21];

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  projectId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [titleLength, setTitleLength] = useState(0);
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState<number | ''>('');
  const [storyPoint, setStoryPoint] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    members: teamMembers,
    loadingMembers,
    membersError,
    retryMembers,
  } = useProjectAssigneeOptions(isOpen ? projectId : null);

  const resetForm = () => {
    setTitle('');
    setTitleLength(0);
    setPriority('MEDIUM');
    setAssignee('');
    setStoryPoint(0);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Task name is required'); return; }
    setSubmitting(true);
    try {
      await onCreateTask({ title: title.trim(), priority, assigneeId: assignee || undefined, storyPoint });
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
      <div className="fixed inset-0 bg-black/40 z-[var(--cu-z-modal)] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-cu-bg rounded-2xl shadow-xl border border-cu-border max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="bg-cu-primary px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus size={20} className="text-white" />
              <h2 className="text-lg font-bold text-white">Create Task</h2>
            </div>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-cu-text-primary">TASK TITLE</label>
            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleLength(e.target.value.length); }}
              placeholder="e.g. Design new landing page"
              className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary focus:outline-none transition-all"
              autoFocus
            />
            {titleLength > 200 && (
              <p className="text-xs text-amber-500 mt-1">{255 - titleLength} characters remaining</p>
            )}
            {error && <p className="text-cu-danger text-xs font-medium">{error}</p>}
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
                      ? `${opt.color} ring-2 ring-cu-primary/30`
                      : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:bg-cu-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Story Points */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
              <Hash size={14} className="text-cu-text-tertiary" /> STORY POINTS
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
                      : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:bg-cu-hover'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
              <User size={14} className="text-cu-text-tertiary" /> ASSIGNEE
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary focus:outline-none transition-all appearance-none"
              disabled={loadingMembers}
            >
              <option value="">{loadingMembers ? 'Loading assignees...' : 'Select Assignee (optional)'}</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
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

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-3 border border-cu-border bg-cu-bg text-cu-text-primary rounded-xl font-bold text-sm hover:bg-cu-hover transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-cu-primary text-white rounded-xl font-bold text-sm hover:bg-cu-primary-hover shadow-md transition-all disabled:opacity-50"
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
