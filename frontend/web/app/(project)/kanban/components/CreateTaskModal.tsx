'use client';

import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User, Plus, Tag, ChevronDown, Flag } from 'lucide-react';
import { Task, Label } from '../types';
import { fetchProject, fetchTeamMembers, fetchProjectLabels } from '../api';
import { formatLocalDate } from '@/lib/date-format';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: Partial<Task>) => Promise<void> | void;
  columnStatus: string;
  projectId: number;
  loading?: boolean;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  columnStatus,
  projectId,
  loading = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [titleLength, setTitleLength] = useState(0);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeDropdownOpen(false);
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) setLabelDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    const taskData: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: columnStatus,
      projectId,
      startDate: startDate ? formatLocalDate(startDate) : undefined,
      dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
      assigneeId: assignee || undefined,
      priority,
      labelId: selectedLabelId ?? undefined,
    };

        try {
          await onCreateTask(taskData);
          setTitle('');
          setTitleLength(0);
          setDescription('');
          setStartDate(null);
          setDueDate(null);
          setAssignee('');
          setPriority('MEDIUM');
          setSelectedLabelId(null);
          setShowDatePicker(false);
          setShowStartDatePicker(false);
          onClose();
        } catch (err) {
          setSubmitError(
            err instanceof Error ? err.message : 'Failed to create task. Please try again.'
          );
          console.error('Task creation error:', err);
        }
  };

  // fetch team members when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (!projectId) return;

    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const project = await fetchProject(projectId);
        if (project.teamId) {
          const members = await fetchTeamMembers(project.teamId);
          setTeamMembers(members || []);
        } else {
          setTeamMembers([]);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
        setTeamMembers([]); // Set empty array on error
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, projectId]);

  // Load project labels
  useEffect(() => {
    if (!isOpen || !projectId) return;
    fetchProjectLabels(projectId).then(setLabels).catch(() => setLabels([]));
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 bg-black/50 z-[var(--cu-z-modal)] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-cu-bg rounded-2xl shadow-cu-xl border border-cu-border max-w-md w-full overflow-visible">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Plus size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white">Create New Task</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <div className="w-5 h-5 bg-cu-primary/10 rounded flex items-center justify-center">
                <span className="text-cu-primary text-xs font-bold">T</span>
              </div>
              Task Title
            </label>
            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleLength(e.target.value.length);
              }}
              placeholder="What needs to be done?"
              className="w-full px-4 py-3 border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-cu-primary/40 focus:border-transparent text-sm transition-all duration-200"
              disabled={loading}
              autoFocus
            />
            {titleLength > 200 && (
              <p className="text-xs text-amber-500 mt-1">
                {255 - titleLength} characters remaining
              </p>
            )}
            {error && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <span className="w-4 h-4 bg-red-500/10 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xs">!</span>
                </span>
                {error}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-cu-text-primary">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description... (optional)"
              maxLength={2000}
              rows={3}
              className="w-full px-4 py-3 border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-cu-primary/40 focus:border-transparent text-sm resize-none transition-all duration-200"
              disabled={loading}
            />
            <p className="text-xs text-cu-text-muted text-right">{description.length}/2000</p>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <Calendar size={16} className="text-cu-text-tertiary" />
              Start Date
              <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all duration-200 ${
                  startDate ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary hover:border-cu-primary/40'
                }`}
                disabled={loading}
              >
                <Calendar size={16} />
                <span className="text-sm">
                  {startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set start date'}
                </span>
              </button>
              {startDate && (
                <button type="button" onClick={() => setStartDate(null)} className="text-xs text-cu-text-muted hover:text-cu-text-secondary" disabled={loading}>Clear</button>
              )}
            </div>
            {showStartDatePicker && (
              <div className="bg-cu-bg-secondary rounded-xl p-4 border border-cu-border">
                <DatePicker selected={startDate} onChange={(d: Date | null) => { setStartDate(d); setShowStartDatePicker(false); }} dateFormat="MMM d, yyyy" inline disabled={loading} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <Calendar size={16} className="text-cu-text-tertiary" />
              Due Date
              <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all duration-200 ${
                  dueDate
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary hover:border-cu-primary/40 hover:bg-cu-hover'
                }`}
                disabled={loading}
              >
                <Calendar size={16} />
                {dueDate ? (
                  <span className="text-sm font-medium">
                    {dueDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                ) : (
                  <span className="text-sm">Set due date</span>
                )}
              </button>

              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate(null)}
                  className="text-xs text-cu-text-muted hover:text-cu-text-secondary px-2 py-1 rounded-lg hover:bg-cu-hover transition-colors"
                  disabled={loading}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Date Picker */}
            {showDatePicker && (
              <div className="bg-cu-bg-secondary rounded-xl p-4 border border-cu-border">
                <DatePicker
                  selected={dueDate}
                  onChange={(date: Date | null) => {
                    setDueDate(date);
                    setShowDatePicker(false);
                  }}
                  dateFormat="MMM d, yyyy"
                  minDate={new Date()}
                  maxDate={new Date(2030, 11, 31)}
                  inline
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Assignee Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <User size={16} className="text-cu-text-tertiary" />
              Assignee
              <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
            </label>

            <div ref={assigneeRef} className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 border border-cu-border rounded-xl text-sm bg-cu-bg text-cu-text-primary hover:bg-cu-hover transition-all duration-200"
                disabled={loading || loadingMembers}
              >
                <span className="text-cu-text-primary">
                  {assignee ? `👤 ${safeTeamMembers.find(m => m.id === assignee)?.name || 'Selected'}` : '👤 Unassigned'}
                </span>
                <ChevronDown size={14} className="text-cu-text-muted" />
              </button>
              {assigneeDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-lg z-[var(--cu-z-modal-popover)] max-h-80 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setAssignee(''); setAssigneeDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cu-primary/10 hover:text-cu-primary transition-colors ${!assignee ? 'font-semibold text-cu-primary bg-cu-primary/10' : 'text-cu-text-primary'}`}
                  >
                    👤 Unassigned
                  </button>
                  {safeTeamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => { setAssignee(member.id); setAssigneeDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cu-primary/10 hover:text-cu-primary transition-colors ${assignee === member.id ? 'font-semibold text-cu-primary bg-cu-primary/10' : 'text-cu-text-primary'}`}
                    >
                      👤 {member.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingMembers && (
              <div className="text-cu-text-tertiary text-xs flex items-center gap-2">
                <div className="w-3 h-3 border border-cu-border border-t-cu-primary rounded-full animate-spin"></div>
                Loading team members...
              </div>
            )}
          </div>

          {/* Label picker */}
          {labels.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
                <Tag size={16} className="text-cu-text-tertiary" />
                Label
                <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
              </label>
              <div ref={labelRef} className="relative">
                <button
                  type="button"
                  onClick={() => setLabelDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-cu-border rounded-xl text-sm bg-cu-bg text-cu-text-primary hover:bg-cu-hover transition-all duration-200"
                  disabled={loading}
                >
                  <span className="flex items-center gap-2">
                    {selectedLabelId ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: labels.find(l => l.id === selectedLabelId)?.color ?? '#6366F1' }} />
                        <span className="text-cu-text-primary">{labels.find(l => l.id === selectedLabelId)?.name}</span>
                      </>
                    ) : (
                      <span className="text-cu-text-tertiary">No label</span>
                    )}
                  </span>
                  <ChevronDown size={14} className="text-cu-text-muted" />
                </button>
                {labelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setSelectedLabelId(null); setLabelDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cu-primary/10 hover:text-cu-primary transition-colors ${!selectedLabelId ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                    >
                      No label
                    </button>
                    {labels.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { setSelectedLabelId(l.id); setLabelDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cu-primary/10 hover:text-cu-primary transition-colors flex items-center gap-2 ${selectedLabelId === l.id ? 'font-semibold text-cu-primary bg-cu-primary/10' : 'text-cu-text-primary'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Priority Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <Flag size={14} className="text-cu-text-muted" />
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => {
                const colors: Record<string, string> = {
                  LOW: 'border-slate-400/40 text-cu-text-tertiary bg-cu-bg-secondary data-[active=true]:bg-slate-500/20 data-[active=true]:border-slate-500 data-[active=true]:text-cu-text-primary',
                  MEDIUM: 'border-amber-500/30 text-amber-500 bg-amber-400/10 data-[active=true]:bg-amber-400/20 data-[active=true]:border-amber-500',
                  HIGH: 'border-orange-500/30 text-orange-500 bg-orange-500/10 data-[active=true]:bg-orange-500/20 data-[active=true]:border-orange-500',
                  URGENT: 'border-red-500/30 text-red-500 bg-red-500/10 data-[active=true]:bg-red-500/20 data-[active=true]:border-red-500',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    data-active={priority === p}
                    onClick={() => setPriority(p)}
                    className={`px-2 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${colors[p]}`}
                    disabled={loading}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 text-sm flex items-start gap-3">
              <div className="w-5 h-5 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div>
                <p className="font-medium">Error creating task</p>
                <p className="text-xs mt-1">{submitError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-cu-border text-cu-text-secondary rounded-xl font-medium text-sm hover:bg-cu-hover transition-all duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-cu-primary to-cu-primary-hover text-white rounded-xl font-medium text-sm hover:from-cu-primary-hover hover:to-cu-primary transition-all duration-200 disabled:from-cu-bg-tertiary disabled:to-cu-bg-tertiary disabled:text-cu-text-muted disabled:cursor-not-allowed shadow-cu-md hover:shadow-cu-lg"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Plus size={16} />
                  Create Task
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
    </OverlayPortal>
  );
}
