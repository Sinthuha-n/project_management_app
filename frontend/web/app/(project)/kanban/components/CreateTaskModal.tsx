'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Calendar, User, Plus, Tag, ChevronDown, Flag, Check, Search } from 'lucide-react';
import { Task, Label } from '../types';
import { fetchProject, fetchTeamMembers, fetchProjectLabels, type TeamMemberOption } from '../api';
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
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
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
  const todayStart = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const selectedMembers = safeTeamMembers.filter(m =>
    selectedAssigneeIds.includes(m.userId ?? m.id) ||
    selectedAssigneeIds.includes(m.id) ||
    (m.memberId != null && selectedAssigneeIds.includes(m.memberId)) ||
    (assignee !== '' && (m.id === assignee || m.userId === assignee || m.memberId === assignee))
  );
  const primaryAssignee = selectedMembers[0] || null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeDropdownOpen(false);
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) setLabelDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggleMember = (member: TeamMemberOption) => {
    const memberId = member.userId ?? member.id;
    const isSelected =
      selectedAssigneeIds.includes(member.id) ||
      (member.userId != null && selectedAssigneeIds.includes(member.userId)) ||
      (member.memberId != null && selectedAssigneeIds.includes(member.memberId)) ||
      (assignee === member.id);

    if (isSelected) {
      const updated = selectedAssigneeIds.filter(
        id => id !== member.id && id !== member.userId && id !== member.memberId
      );
      setSelectedAssigneeIds(updated);
      setAssignee(updated[0] ?? '');
    } else {
      const updated = Array.from(new Set([...selectedAssigneeIds, memberId]));
      setSelectedAssigneeIds(updated);
      setAssignee(updated[0] ?? '');
    }
  };

  const handleRemoveMember = (memberId: number) => {
    const updated = selectedAssigneeIds.filter(id => id !== memberId);
    setSelectedAssigneeIds(updated);
    setAssignee(updated[0] ?? '');
  };

  const handleClearAssignees = () => {
    setSelectedAssigneeIds([]);
    setAssignee('');
    setAssigneeDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitError(null);

    if (!title.trim()) {
      setError('Task name is required');
      return;
    }

    if (startDate && startDate < todayStart) {
      setSubmitError('Start date cannot be in the past.');
      return;
    }

    if (dueDate && dueDate < todayStart) {
      setSubmitError('Due date cannot be in the past.');
      return;
    }

    const resolvedAssigneeIds = selectedMembers.map(m => m.userId ?? m.id);
    const resolvedPrimaryId = selectedMembers[0]?.id ?? (selectedAssigneeIds[0] ?? (assignee ? Number(assignee) : undefined));

    const taskData: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: columnStatus,
      projectId,
      startDate: startDate ? formatLocalDate(startDate) : undefined,
      dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
      assigneeId: resolvedPrimaryId,
      assigneeIds: resolvedAssigneeIds.length > 0 ? resolvedAssigneeIds : (resolvedPrimaryId ? [resolvedPrimaryId] : undefined),
      assignees: selectedMembers.map(m => ({
        id: m.id,
        memberId: m.memberId ?? m.id,
        userId: m.userId ?? m.id,
        name: m.name,
        photoUrl: m.photoUrl ?? undefined,
      })),
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
      setSelectedAssigneeIds([]);
      setAssigneeSearch('');
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
      <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cu-border bg-cu-bg shadow-cu-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
                <Plus size={20} className="text-white" />
              </div>
              <h2 className="truncate text-lg font-semibold text-white sm:text-xl">Create New Task</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition-all duration-200 hover:bg-white/30"
              aria-label="Close create task modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto p-4 sm:p-6">
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
              className="w-full rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm text-cu-text-primary transition-all duration-200 placeholder:text-cu-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-primary/40"
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
              className="w-full resize-none rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm text-cu-text-primary transition-all duration-200 placeholder:text-cu-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-primary/40"
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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border-2 px-4 py-2 transition-all duration-200 ${
                  startDate ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary hover:border-cu-primary/40'
                }`}
                disabled={loading}
              >
                <Calendar size={16} />
                <span className="truncate text-sm">
                  {startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set start date'}
                </span>
              </button>
              {startDate && (
                <button type="button" onClick={() => setStartDate(null)} className="text-xs text-cu-text-muted hover:text-cu-text-secondary" disabled={loading}>Clear</button>
              )}
            </div>
            {showStartDatePicker && (
              <div className="bg-cu-bg-secondary rounded-xl p-4 border border-cu-border">
                <DatePicker selected={startDate} onChange={(d: Date | null) => { setStartDate(d); setShowStartDatePicker(false); }} dateFormat="MMM d, yyyy" minDate={todayStart} inline disabled={loading} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
              <Calendar size={16} className="text-cu-text-tertiary" />
              Due Date
              <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border-2 px-4 py-2 transition-all duration-200 ${
                  dueDate
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary hover:border-cu-primary/40 hover:bg-cu-hover'
                }`}
                disabled={loading}
              >
                <Calendar size={16} />
                {dueDate ? (
                  <span className="truncate text-sm font-medium">
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
                  minDate={todayStart}
                  maxDate={new Date(2030, 11, 31)}
                  inline
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Assignee Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-cu-text-primary flex items-center gap-2">
                <User size={16} className="text-cu-text-tertiary" />
                Assignees
                <span className="text-xs text-cu-text-muted font-normal">(Optional)</span>
              </label>
              {selectedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAssignees}
                  className="text-xs text-cu-danger hover:underline transition-colors"
                >
                  Clear all ({selectedMembers.length})
                </button>
              )}
            </div>

            <div ref={assigneeRef} className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen(o => !o)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm text-cu-text-primary transition-all duration-200 hover:bg-cu-hover"
                disabled={loading || loadingMembers}
                aria-haspopup="listbox"
                aria-expanded={assigneeDropdownOpen}
              >
                <span className="flex min-w-0 items-center gap-2 text-cu-text-primary">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cu-bg-tertiary text-[11px] font-semibold text-cu-text-secondary">
                    {primaryAssignee?.photoUrl ? (
                      <Image src={primaryAssignee.photoUrl} alt={primaryAssignee.name} width={28} height={28} className="h-full w-full object-cover" unoptimized />
                    ) : primaryAssignee ? (
                      primaryAssignee.name.charAt(0).toUpperCase()
                    ) : (
                      <User size={14} />
                    )}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate font-medium">
                      {selectedMembers.length === 0
                        ? 'Unassigned'
                        : selectedMembers.length === 1
                          ? primaryAssignee?.name
                          : `${selectedMembers.length} assignees selected`}
                    </span>
                    <span className="block truncate text-xs text-cu-text-muted">
                      {selectedMembers.length === 0
                        ? 'Choose a project member'
                        : selectedMembers.map(m => m.name).join(', ')}
                    </span>
                  </span>
                </span>
                <ChevronDown size={14} className="flex-shrink-0 text-cu-text-muted" />
              </button>

              {/* Selected Assignee Chips */}
              {selectedMembers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMembers.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-cu-border bg-cu-bg-secondary py-0.5 pl-1 pr-2 text-xs text-cu-text-primary"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[9px] font-bold text-white">
                        {m.photoUrl ? (
                          <Image src={m.photoUrl} alt={m.name} width={20} height={20} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          m.name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="max-w-[120px] truncate">{m.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMember(m.userId ?? m.id);
                        }}
                        className="rounded-full p-0.5 text-cu-text-muted hover:bg-cu-hover hover:text-cu-danger transition-colors"
                        title={`Remove ${m.name}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {assigneeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-[var(--cu-z-modal-popover)] mt-1 max-h-80 overflow-y-auto rounded-xl border border-cu-border bg-cu-bg p-1 shadow-lg" role="listbox">
                  {safeTeamMembers.length > 4 && (
                    <div className="mb-1 flex items-center rounded-lg border border-cu-border bg-cu-bg-secondary px-2.5 py-1.5 focus-within:border-cu-primary">
                      <Search size={12} className="text-cu-text-muted mr-1.5 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        className="w-full bg-transparent text-xs text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none"
                      />
                      {assigneeSearch && (
                        <button
                          type="button"
                          onClick={() => setAssigneeSearch('')}
                          className="text-cu-text-muted hover:text-cu-text-primary"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleClearAssignees}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-cu-hover ${selectedMembers.length === 0 ? 'bg-cu-primary/10 font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                    role="option"
                    aria-selected={selectedMembers.length === 0}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cu-bg-tertiary text-cu-text-muted">
                        <User size={13} />
                      </span>
                      <span className="truncate">Unassigned</span>
                    </div>
                    {selectedMembers.length === 0 && <Check size={13} className="text-cu-primary flex-shrink-0" />}
                  </button>

                  {safeTeamMembers
                    .filter(m => !assigneeSearch.trim() || m.name.toLowerCase().includes(assigneeSearch.toLowerCase().trim()))
                    .map((member) => {
                      const isSelected = selectedMembers.some(m => m.id === member.id || (m.userId != null && m.userId === member.userId));
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleToggleMember(member)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-cu-hover ${isSelected ? 'bg-cu-primary/10 font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cu-bg-tertiary text-[11px] font-semibold">
                              {member.photoUrl ? (
                                <Image src={member.photoUrl} alt={member.name} width={24} height={24} className="h-full w-full object-cover" unoptimized />
                              ) : (
                                member.name.charAt(0).toUpperCase()
                              )}
                            </span>
                            <span className="truncate">{member.name}</span>
                          </div>
                          <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors flex-shrink-0 ${isSelected ? 'border-cu-primary bg-cu-primary text-white' : 'border-cu-border bg-cu-bg'}`}>
                            {isSelected && <Check size={10} strokeWidth={2.5} />}
                          </div>
                        </button>
                      );
                    })}
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
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm text-cu-text-primary transition-all duration-200 hover:bg-cu-hover"
                  disabled={loading}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedLabelId ? (
                      <>
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: labels.find(l => l.id === selectedLabelId)?.color ?? '#6366F1' }} />
                        <span className="truncate text-cu-text-primary">{labels.find(l => l.id === selectedLabelId)?.name}</span>
                      </>
                    ) : (
                      <span className="text-cu-text-tertiary">No label</span>
                    )}
                  </span>
                  <ChevronDown size={14} className="flex-shrink-0 text-cu-text-muted" />
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
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-cu-primary/10 hover:text-cu-primary ${selectedLabelId === l.id ? 'bg-cu-primary/10 font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                        <span className="min-w-0 truncate">{l.name}</span>
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
            <div className="grid grid-cols-2 gap-1 min-[420px]:grid-cols-4">
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
                    className={`min-w-0 rounded-lg border-2 px-2 py-1.5 text-xs font-semibold transition-all ${colors[p]}`}
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
                  <p className="mt-1 break-words text-xs">{submitError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2 min-[420px]:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-cu-border px-4 py-3 text-sm font-medium text-cu-text-secondary transition-all duration-200 hover:bg-cu-hover"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-cu-primary to-cu-primary-hover px-4 py-3 text-sm font-medium text-white shadow-cu-md transition-all duration-200 hover:from-cu-primary-hover hover:to-cu-primary hover:shadow-cu-lg disabled:cursor-not-allowed disabled:from-cu-bg-tertiary disabled:to-cu-bg-tertiary disabled:text-cu-text-muted"
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
