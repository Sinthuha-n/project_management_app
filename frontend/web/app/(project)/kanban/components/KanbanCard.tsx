'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Label } from '../types';
import { Calendar, GitBranch, GitPullRequest, MessageSquare, Paperclip, Check, X, Tag, Plus, ChevronDown, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import { CIStatusBadge } from '@/components/ui';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
  onOpenTask?: (taskId: number) => void;
  onInlineUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  usersMap?: Record<string, string | null>;
  labels?: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  isSyncing?: boolean;
}

const PRIORITY_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  URGENT: { border: 'border-l-red-500',    bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500' },
  HIGH:   { border: 'border-l-orange-500', bg: 'bg-orange-500/10',  text: 'text-orange-500',  dot: 'bg-orange-500' },
  MEDIUM: { border: 'border-l-amber-400',  bg: 'bg-amber-400/10',   text: 'text-amber-500',   dot: 'bg-amber-400' },
  LOW:    { border: 'border-l-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-400' },
};

const PRIORITY_LIST = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const LABEL_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function KanbanCard({ task, onDelete, onOpenTask, onInlineUpdate, usersMap, labels: allLabels, onCreateLabel, isSyncing }: KanbanCardProps) {
  const avatarUrl =
    resolveProfilePhotoUrl(task.assigneePhotoUrl, task.assigneeId) ??
    (task.assigneeName ? resolveProfilePhotoUrl(usersMap?.[task.assigneeName]) : null);
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const pStyle = task.priority ? PRIORITY_COLORS[task.priority] : null;
  const priorityBorder = pStyle ? pStyle.border : 'border-l-transparent';
  const isBlocked = task.dependencies?.some(d => d.relation === 'BLOCKED_BY' && d.status !== 'DONE') ?? false;

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority || 'MEDIUM');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Inline label picker
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
      setEditPriority(task.priority || 'MEDIUM');
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isEditing, task.title, task.priority]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) setShowLabelPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveInline = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      if (onInlineUpdate) await onInlineUpdate(task.id, { title: editTitle.trim(), priority: editPriority });
      setIsEditing(false);
    } catch (err) { console.error('Inline save failed:', err); }
    finally { setSaving(false); }
  };

  const handleCancelEdit = () => { setEditTitle(task.title); setEditPriority(task.priority || 'MEDIUM'); setIsEditing(false); };

  const handleSetDueDate = async (date: string | undefined) => {
    if (!onInlineUpdate) return;
    await onInlineUpdate(task.id, { dueDate: date, title: task.title });
    setShowDatePicker(false);
  };

  const handleSetLabel = async (labelId: number | undefined) => {
    if (!onInlineUpdate) return;
    await onInlineUpdate(task.id, { labelId: labelId, title: task.title });
    setShowLabelPicker(false);
  };

  const handleCreateNewLabel = async () => {
    if (!onCreateLabel || !newLabelName.trim()) return;
    const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
    if (label && onInlineUpdate) {
      await onInlineUpdate(task.id, { labelId: label.id, title: task.title });
    }
    setNewLabelName('');
    setShowLabelPicker(false);
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id.toString(),
    data: { type: 'task', taskId: task.id },
    disabled: isEditing,
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return null; }
  };

  const dueDateFormatted = formatDate(task.dueDate);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString()) && task.status !== 'DONE';
  const isToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();

  // Card background: overdue tasks get subtle reddish tint
  const cardBg = isOverdue ? 'bg-red-500/5' : 'bg-cu-bg';

  // ── INLINE EDIT MODE ──────────────────────────────────────
  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-lg bg-cu-bg border-2 border-cu-primary shadow-lg p-3">
        <input ref={titleInputRef} type="text" maxLength={255} value={editTitle} onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSaveInline(); if (e.key === 'Escape') handleCancelEdit(); }}
          className="w-full text-[13px] font-medium text-cu-text-primary border-0 border-b border-cu-border pb-1.5 mb-2 focus:outline-none focus:border-cu-primary bg-transparent" placeholder="Task title..." />
        {editTitle.length > 200 && (
          <p className="text-xs text-amber-500 mt-1">
            {255 - editTitle.length} characters remaining
          </p>
        )}
        <div className="mb-2">
          <p className="text-[10px] text-cu-text-muted font-medium mb-1">Priority</p>
          <div className="flex gap-1">
            {PRIORITY_LIST.map(p => {
              const pc = PRIORITY_COLORS[p]; const isActive = editPriority === p;
              return (
                <button key={p} type="button" onClick={() => setEditPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${isActive ? `${pc.bg} ${pc.text} border-current` : 'bg-cu-bg-secondary text-cu-text-muted border-cu-border hover:border-cu-border'}`}>{p}</button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-1.5 pt-1 border-t border-cu-border">
          <button onClick={handleCancelEdit} disabled={saving} className="px-2 py-1 text-xs text-cu-text-secondary hover:text-cu-text-primary rounded transition-colors flex items-center gap-1"><X size={12} /> Cancel</button>
          <button onClick={() => void handleSaveInline()} disabled={saving || !editTitle.trim()}
            className="px-2.5 py-1 text-xs font-medium text-white bg-cu-primary rounded hover:bg-cu-primary-hover disabled:opacity-40 transition-colors flex items-center gap-1">
            {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      </div>
    );
  }

  // Normal display mode
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (!isDragging && onOpenTask) onOpenTask(task.id);
      }}
      className={`
        group relative rounded-lg ${cardBg} border border-cu-border border-l-[3px] ${priorityBorder}
        shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
        transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-cu-primary/50 scale-[1.02] rotate-[1deg]' : 'hover:border-cu-border'}
        ${isOverdue ? 'border-red-500/30' : ''}
      `}
    >
      {/* Hover action bar */}
      {(onInlineUpdate || onDelete) && (
        <div className="absolute -top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 flex items-center gap-0.5 bg-cu-bg border border-cu-border rounded-md shadow-sm px-0.5 py-0.5">
          {onInlineUpdate && (
            <button data-action="edit" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1 text-cu-text-muted hover:text-cu-primary hover:bg-cu-primary/10 rounded transition-colors" title="Edit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {onDelete && (
            <button data-action="delete" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1 text-cu-text-muted hover:text-cu-danger hover:bg-cu-danger/10 rounded transition-colors" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      )}

      <div className="p-3">
        {/* Subtle syncing indicator when a background mutation is in-flight for this task */}
        {/** Position absolute to not affect layout */}
        {/** Renders a small spinner badge in the top-left */}
        {/* actual indicator (no-op placeholder removed) */}
        {/* Top row: labels + task ID */}
        {isSyncing && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2 text-[11px] text-cu-text-muted">
            <div className="w-3 h-3 border border-cu-border border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">Syncing</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex flex-wrap gap-1 min-w-0">
            {/* Show task labels: resolve from allLabels if task.labels not populated */}
            {(() => {
              const displayLabels = (task.labels && task.labels.length > 0)
                ? task.labels
                : (task.labelId && allLabels?.length)
                  ? allLabels.filter(l => l.id === task.labelId)
                  : [];
              return displayLabels.slice(0, 3).map((label) => (
                <span key={label.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: (label.color ?? '#6366F1') + '18', color: label.color ?? '#6366F1' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6366F1' }} />
                  {label.name}
                </span>
              ));
            })()}
          </div>
          <span className="text-[10px] text-cu-text-muted font-mono whitespace-nowrap flex-shrink-0">#{task.id}</span>
        </div>

        {/* Title */}
        <p className="text-[13px] font-medium text-cu-text-primary leading-snug line-clamp-2 mb-2">{task.title}</p>

        {/* Priority and Blocked badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isBlocked && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500">
              <Lock size={10} className="flex-shrink-0" /> Blocked
            </div>
          )}
          {pStyle && task.priority && (
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${pStyle.text} ${pStyle.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} /> {task.priority}
            </div>
          )}
          {task.recurrenceRule && (
            <div
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                task.recurrenceActive === false
                  ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
                  : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
              }`}
              title={task.recurrenceActive === false ? 'Recurring (Paused)' : `Recurring (${task.recurrenceRule})`}
            >
              <RefreshCw size={10} className="flex-shrink-0" />
              <span>Recurring{task.recurrenceActive === false ? ' (Paused)' : ''}</span>
            </div>
          )}
        </div>

        {/* Subtask checklist: ClickUp style */}
        {totalSubtasks > 0 && (
          <div className="mb-2">
            {/* Progress bar and Toggle */}
            <div 
              className="flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-cu-hover rounded-md p-0.5 -ml-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              data-action="toggle-subtasks"
            >
              {isExpanded ? <ChevronDown size={11} className="text-cu-text-muted" /> : <ChevronRight size={11} className="text-cu-text-muted" />}
              <GitBranch size={11} className="text-cu-text-muted flex-shrink-0" />
              <div className="flex-1 h-1 rounded-full bg-cu-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${subtaskPercent}%` }} />
              </div>
              <span className="text-[10px] text-cu-text-secondary font-medium whitespace-nowrap">{completedSubtasks}/{totalSubtasks}</span>
            </div>

            {/* Individual subtask items (only shown when expanded) */}
            {isExpanded && (
              <div className="space-y-1 pl-1">
                {task.subtasks!.map(st => (
                  <div key={st.id} className="relative bg-cu-bg-secondary/50 border border-cu-border rounded-md p-1.5 pl-2 mb-1 last:mb-0 hover:bg-cu-bg hover:border-cu-primary/30 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${st.status === 'DONE' ? 'bg-cu-primary border-cu-primary' : 'border-cu-border'}`}>
                        {st.status === 'DONE' && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] font-medium leading-tight ${st.status === 'DONE' ? 'text-cu-text-muted line-through' : 'text-cu-text-primary'}`}>
                        {st.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Bottom meta row: due date (clickable), label (clickable), story points, assignee */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Due date: inline pickable */}
            <div className="relative" ref={datePickerRef}>
              <button
                data-action="date"
                onClick={(e) => { e.stopPropagation(); setShowDatePicker(o => !o); }}
                className={`flex items-center gap-1 text-[11px] rounded px-1 py-0.5 transition-colors ${
                  isOverdue ? 'text-red-500 font-semibold bg-red-500/10 hover:bg-red-500/20' :
                  isToday ? 'text-cu-primary font-medium bg-cu-primary/10 hover:bg-cu-primary/20' :
                  dueDateFormatted ? 'text-cu-text-secondary hover:bg-cu-hover' :
                  'text-cu-text-muted hover:bg-cu-hover'
                }`}
                title="Set due date"
              >
                <Calendar size={11} className={isOverdue ? 'text-red-500' : isToday ? 'text-cu-primary' : 'text-cu-text-muted'} />
                {isOverdue ? 'Overdue' : isToday ? 'Today' : dueDateFormatted || ''}
              </button>

              {showDatePicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-50 p-2 w-48" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-cu-text-muted mb-1.5">Due date</p>
                  <input
                    type="date"
                    value={task.dueDate || ''}
                    onChange={(e) => void handleSetDueDate(e.target.value || undefined)}
                    className="w-full px-2 py-1.5 border border-cu-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary"
                  />
                  {task.dueDate && (
                    <button onClick={() => void handleSetDueDate(undefined)}
                      className="mt-1 text-[10px] text-red-500 hover:text-red-700 transition-colors">Remove date</button>
                  )}
                </div>
              )}
            </div>

            {/* Label: inline pickable */}
            <div className="relative" ref={labelPickerRef}>
              <button
                data-action="label"
                onClick={(e) => { e.stopPropagation(); setShowLabelPicker(o => !o); }}
                className="flex items-center gap-1 text-[11px] text-cu-text-muted hover:bg-cu-hover rounded px-1 py-0.5 transition-colors"
                title="Set label"
              >
                <Tag size={10} />
                {(() => {
                  const currentLabel = (task.labels && task.labels.length > 0)
                    ? task.labels[0]
                    : (task.labelId && allLabels?.length)
                      ? allLabels.find(l => l.id === task.labelId)
                      : null;
                  return currentLabel ? (
                    <span style={{ color: currentLabel.color ?? '#6366F1' }}>{currentLabel.name}</span>
                  ) : null;
                })()}
              </button>

              {showLabelPicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-50 p-2 w-52" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-cu-text-muted mb-1.5">Labels</p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5 mb-1.5">
                    {/* No label option */}
                    <button onClick={() => void handleSetLabel(undefined)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-cu-hover transition-colors ${!task.labelId ? 'font-semibold text-cu-primary' : 'text-cu-text-secondary'}`}>
                      None
                    </button>
                    {allLabels?.map(l => (
                      <button key={l.id} onClick={() => void handleSetLabel(l.id)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-cu-hover transition-colors flex items-center gap-2 ${task.labelId === l.id ? 'font-semibold text-cu-primary bg-cu-primary/5' : 'text-cu-text-secondary'}`}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                        {l.name}
                      </button>
                    ))}
                  </div>

                  {/* Create new label */}
                  {onCreateLabel && (
                    <div className="border-t border-cu-border pt-1.5">
                      <p className="text-[10px] font-medium text-cu-text-muted mb-1">New label</p>
                      <div className="flex items-center gap-1">
                        <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void handleCreateNewLabel(); }}
                          placeholder="Name..." className="flex-1 px-1.5 py-1 border border-cu-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary" />
                        <button onClick={() => void handleCreateNewLabel()} disabled={!newLabelName.trim()}
                          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors">
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {LABEL_COLORS.map(c => (
                          <button key={c} onClick={() => setNewLabelColor(c)}
                            className={`w-4 h-4 rounded-full transition-transform ${newLabelColor === c ? 'ring-2 ring-offset-1 ring-blue-400 scale-110' : ''}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Story points */}
            {task.storyPoint != null && task.storyPoint > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded bg-violet-500/10 text-violet-500 text-[10px] font-bold px-1">{task.storyPoint}</span>
            )}

            {/* Comment count */}
            {task.commentCount != null && task.commentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-cu-text-muted"><MessageSquare size={10} /><span>{task.commentCount}</span></div>
            )}

            {/* Attachment count */}
            {task.attachmentCount != null && task.attachmentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-cu-text-muted"><Paperclip size={10} /><span>{task.attachmentCount}</span></div>
            )}

            {/* GitHub: CI status (icon-only) + open PR count */}
            {task.ciStatus && (
              <CIStatusBadge status={task.ciStatus} size="sm" showLabel={false} />
            )}
            {(task.openPrCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-500">
                <GitPullRequest size={9} aria-hidden="true" />
                {task.openPrCount}
              </span>
            )}
          </div>

          {/* Assignee avatar */}
          {task.assigneeName && (
            <div className="flex-shrink-0" title={task.assigneeName}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[11px] font-bold flex items-center justify-center overflow-hidden ring-2 ring-cu-bg shadow-sm">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={task.assigneeName} width={28} height={28} className="w-full h-full object-cover" unoptimized />
                ) : (
                  task.assigneeName.charAt(0).toUpperCase()
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
