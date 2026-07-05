'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User, Plus } from 'lucide-react';
import { useProjectAssigneeOptions } from '@/hooks/projects/useProjectAssigneeOptions';
import { normalizeApiError } from '@/lib/api-error';
import { formatLocalDate } from '@/lib/date-format';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: Record<string, unknown>) => Promise<void>;
  columnStatus: string;
  projectId: number;
  sprintId?: number;
  loading?: boolean;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  columnStatus,
  projectId,
  sprintId,
  loading = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [titleLength, setTitleLength] = useState(0);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const {
    members: teamMembers,
    loadingMembers,
    membersError,
    retryMembers,
  } = useProjectAssigneeOptions(isOpen ? projectId : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    const today = formatLocalDate(new Date());

    const taskData = {
      title: title.trim(),
      status: columnStatus,
      projectId,
      sprintId,
      startDate: today,
      dueDate: dueDate ? formatLocalDate(dueDate) : today,
      assigneeId: assignee || undefined,
      description: '',
      priority: 'MEDIUM',
      storyPoint: 0
    };

    try {
      await onCreateTask(taskData);
      setTitle('');
      setTitleLength(0);
      setDueDate(null);
      setAssignee('');
      setShowDatePicker(false);
      onClose();
    } catch (err: unknown) {
      setSubmitError(normalizeApiError(err, 'Failed to create task.'));
      console.error('Task creation error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in overflow-hidden rounded-2xl border border-cu-border bg-cu-bg shadow-cu-xl duration-200 fade-in zoom-in-95">
        <div className="bg-cu-primary px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus size={20} className="text-white" />
              <h2 className="text-lg font-bold text-white">Create Sprint Task</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
              className="w-full rounded-xl border border-cu-border bg-cu-bg-secondary px-4 py-3 text-sm text-cu-text-primary transition-all placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
              autoFocus
            />
            {titleLength > 200 && (
              <p className="text-xs text-amber-500 mt-1">
                {255 - titleLength} characters remaining
              </p>
            )}
            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[13px] font-bold text-cu-text-primary">
              <Calendar size={14} className="text-cu-text-muted" /> DUE DATE
            </label>
            <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex w-full items-center justify-between rounded-xl border border-cu-border bg-cu-bg-secondary px-4 py-3 text-left text-sm text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
            >
                {dueDate ? dueDate.toLocaleDateString() : 'Set due date (optional)'}
                <Calendar size={16} className="text-cu-text-muted" />
            </button>
            {showDatePicker && (
                <div className="absolute z-[110] mt-1 rounded-xl border border-cu-border bg-cu-bg p-2 shadow-cu-xl">
                     <DatePicker
                        selected={dueDate}
                        onChange={(date: Date | null) => {
                            setDueDate(date);
                            setShowDatePicker(false);
                        }}
                        inline
                    />
                </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[13px] font-bold text-cu-text-primary">
              <User size={14} className="text-cu-text-muted" /> ASSIGNEE
            </label>
            <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full appearance-none rounded-xl border border-cu-border bg-cu-bg-secondary px-4 py-3 text-sm text-cu-text-secondary transition-all focus:outline-none focus:ring-2 focus:ring-cu-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingMembers}
            >
                <option value="">{loadingMembers ? 'Loading assignees...' : 'Select Assignee (optional)'}</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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

          {submitError && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-500">{submitError}</div>}

          <div className="flex gap-3 pt-3">
             <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-cu-border px-4 py-3 text-sm font-bold text-cu-text-secondary transition-all hover:bg-cu-hover hover:text-cu-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-cu-primary px-4 py-3 text-sm font-bold text-white shadow-cu-md transition-all hover:bg-cu-primary-hover disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
