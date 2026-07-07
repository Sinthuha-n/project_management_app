'use client';

import React, { useState } from 'react';
import { X, Rocket, Calendar, Target } from 'lucide-react';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSprint: (name: string, startDate?: string, endDate?: string, goal?: string) => Promise<void>;
  defaultName: string;
}

export default function CreateSprintModal({
  isOpen,
  onClose,
  onCreateSprint,
  defaultName,
}: CreateSprintModalProps) {
  const [name, setName] = useState(defaultName);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.setSelectionRange(defaultName.length, defaultName.length);
        }
      }, 50);
    }
  }, [isOpen, defaultName]);

  const resetForm = () => {
    setName(defaultName);
    setStartDate('');
    setEndDate('');
    setGoal('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sprint name is required');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after start date');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateSprint(name.trim(), startDate || undefined, endDate || undefined, goal.trim() || undefined);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to create sprint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[var(--cu-z-modal)] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-cu-bg rounded-2xl shadow-xl border border-cu-border max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="relative bg-cu-primary px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <Rocket size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Sprint</h2>
              <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider">Scrum Planning</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="absolute right-4 top-4 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-cu-text-primary">SPRINT NAME</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 1"
              className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:ring-2 focus:ring-cu-primary/20 focus:outline-none focus:border-cu-primary transition-all font-medium"
            />
            {error && <p className="text-cu-danger text-xs font-medium">{error}</p>}
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
                <Calendar size={14} className="text-cu-text-tertiary" /> START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary transition-all cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
                <Calendar size={14} className="text-cu-text-tertiary" /> END DATE
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Sprint Goal */}
          <div className="hidden sm:block space-y-2">
            <label className="text-[13px] font-bold text-cu-text-primary flex items-center gap-2">
              <Target size={14} className="text-cu-text-tertiary" /> SPRINT GOAL
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do we want to achieve in this sprint?"
              rows={3}
              className="w-full px-4 py-3 bg-cu-bg-secondary border border-cu-border rounded-xl text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:ring-2 focus:ring-cu-primary/20 focus:outline-none focus:border-cu-primary transition-all resize-none font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-3 border border-cu-border bg-cu-bg text-cu-text-primary rounded-xl font-bold text-sm hover:bg-cu-hover transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-cu-primary text-white rounded-xl font-bold text-sm hover:bg-cu-primary-hover shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
