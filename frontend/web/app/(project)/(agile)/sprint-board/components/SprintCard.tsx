'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SprintboardTask } from '../types';
import { Calendar, GripVertical, Lock, MoreHorizontal, Pencil, Trash2, Check, UserPlus } from 'lucide-react';
import AssigneeAvatar from '../../sprint-backlog/components/AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { SprintTeamMemberOption } from '../api';

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: 'bg-red-500/10',    text: 'text-red-500',    label: 'High' },
  URGENT: { bg: 'bg-red-500/10',    text: 'text-red-500',    label: 'Urgent' },
  MEDIUM: { bg: 'bg-amber-400/10',  text: 'text-amber-500',  label: 'Medium' },
  LOW:    { bg: 'bg-cu-bg-tertiary', text: 'text-cu-text-secondary', label: 'Low' },
};

interface SprintCardProps {
  task: SprintboardTask;
  projectKey?: string;
  onOpenTask?: (id: number) => void;
  dense?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: number, selected: boolean) => void;
  onUpdateDueDate?: (taskId: number, dueDate: string | null) => Promise<void>;
  onAssignSingle?: (taskId: number, userId: number) => Promise<void>;
  onAssignMultiple?: (taskId: number, assigneeIds: number[]) => Promise<void>;
  onRenameTask?: (taskId: number, title: string) => Promise<void> | void;
  onDeleteTask?: (taskId: number) => Promise<void> | void;
  teamMembers?: SprintTeamMemberOption[];
}

export default function SprintCard({
  task,
  projectKey,
  onOpenTask,
  dense = false,
  selected = false,
  onToggleSelect,
  onUpdateDueDate,
  onAssignSingle,
  onAssignMultiple,
  onRenameTask,
  onDeleteTask,
  teamMembers = [],
}: SprintCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.taskId.toString(),
    data: { type: 'task', taskId: task.taskId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const dueDateFormatted = formatDate(task.dueDate);
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'DONE';

  const priorityStyle = PRIORITY_STYLES[(task.priority || '').toUpperCase()];
  const [dateOpen, setDateOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'single' | 'multi'>('single');
  const [multiSelected, setMultiSelected] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState(task.title);

  const menuRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  // Sync rename title if task title updates from outside
  useEffect(() => {
    setRenameTitle(task.title);
  }, [task.title]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayKey = projectKey && task.projectTaskNumber
    ? `#${projectKey}-${task.projectTaskNumber}`
    : `#${task.taskId}`;

  // Multiple assignees list resolution
  const assigneesList = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assigneeName
      ? [{ name: task.assigneeName, photoUrl: task.assigneePhotoUrl }]
      : [];

  const handleOpenAssignee = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Initialize multiSelected from existing assignees
    const initialIds = (task.assignees || [])
      .map((a) => a.userId ?? a.memberId)
      .filter((id): id is number => typeof id === 'number');

    if (initialIds.length === 0 && task.assigneeName) {
      const match = teamMembers.find((m) => m.name === task.assigneeName);
      if (match) initialIds.push(match.userId ?? match.id);
    }
    setMultiSelected(initialIds);
    setAssignMode(initialIds.length > 1 ? 'multi' : 'single');
    setAssigneeOpen((prev) => !prev);
  };

  const toggleMultiMember = (member: SprintTeamMemberOption) => {
    const memberUserId = member.userId ?? member.id;
    setMultiSelected((prev) =>
      prev.includes(memberUserId) ? prev.filter((id) => id !== memberUserId) : [...prev, memberUserId]
    );
  };

  const handleSingleAssign = (member: SprintTeamMemberOption) => {
    const memberUserId = member.userId ?? member.id;
    setAssigneeOpen(false);
    void onAssignSingle?.(task.taskId, memberUserId);
  };

  const handleMultiAssignApply = () => {
    setAssigneeOpen(false);
    void onAssignMultiple?.(task.taskId, multiSelected);
  };

  const handleCommitRename = () => {
    const trimmed = renameTitle.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== task.title) {
      void onRenameTask?.(task.taskId, trimmed);
    } else {
      setRenameTitle(task.title);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        rounded-xl border bg-cu-bg shadow-cu-sm group/card
        hover:shadow-cu-md hover:border-cu-primary/30 transition-all duration-200 cursor-grab active:cursor-grabbing
        focus-within:ring-2 focus-within:ring-[var(--cu-focus-ring)]
        ${dense ? 'p-2.5' : 'p-3'}
        ${selected ? 'border-cu-primary ring-2 ring-cu-primary/20' : 'border-cu-border'}
        ${isDragging ? 'ring-2 ring-cu-primary z-50 scale-[1.02]' : ''}
      `}
    >
      {/* Card Header Row: Checkbox, Task ID, and Actions Menu */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label
            className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-cu-text-muted cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelect?.(task.taskId, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-cu-border text-cu-primary focus:ring-cu-primary cursor-pointer"
            />
          </label>
          <span className="rounded-md border border-cu-border bg-cu-bg-secondary px-1.5 py-0.5 font-semibold text-[10px] text-cu-text-secondary">
            {displayKey}
          </span>
        </div>

        {/* Task Actions Menu */}
        <div className="relative flex items-center gap-1" ref={menuRef} onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="p-1 rounded-md text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover transition-colors opacity-60 group-hover/card:opacity-100 focus:opacity-100"
            title="Task options"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-cu-border bg-cu-bg p-1 shadow-cu-xl z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setIsRenaming(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-cu-text-primary hover:bg-cu-hover transition-colors text-left"
              >
                <Pencil size={13} className="text-cu-text-muted" />
                <span>Rename task</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  void onDeleteTask?.(task.taskId);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 size={13} />
                <span>Delete task</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Title / Inline Rename */}
      <div className={`flex items-start gap-1.5 ${dense ? 'mb-2' : 'mb-2.5'}`}>
        <GripVertical size={14} className="text-cu-text-muted/40 mt-0.5 flex-shrink-0" />
        {isRenaming ? (
          <div className="flex-1 min-w-0" onPointerDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={renameTitle}
              maxLength={255}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitRename();
                }
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setRenameTitle(task.title);
                }
              }}
              onBlur={handleCommitRename}
              className="w-full rounded-md border border-cu-primary bg-cu-bg px-2 py-1 text-xs text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20 shadow-sm"
              placeholder="Task name..."
            />
          </div>
        ) : (
          <h3
            className={`font-semibold text-cu-text-primary leading-tight cursor-pointer hover:text-cu-primary transition-colors flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-cu-primary/20 rounded ${dense ? 'text-[13px]' : 'text-[14px]'}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenTask?.(task.taskId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onOpenTask?.(task.taskId);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open task ${task.title}`}
          >
            {task.title}
          </h3>
        )}

        {task.label && (
          <span
            style={hexToLabelStyle(task.label.color ?? '#6366F1')}
            className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap mt-0.5"
          >
            {task.label.name}
          </span>
        )}
      </div>

      {/* Date */}
      <div className={`relative flex items-center gap-2 text-[11px] font-medium text-cu-text-secondary ${dense ? 'mb-2' : 'mb-3'}`} onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDateOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-cu-primary/10 transition-colors"
          aria-label="Edit due date"
        >
          <Calendar size={14} className={isOverdue ? 'text-red-500' : 'text-cu-text-muted'} />
          <span className={isOverdue ? 'text-red-500' : ''}>{dueDateFormatted ?? 'Set due date'}</span>
        </button>
        {dateOpen && (
          <div
            className="absolute top-6 left-0 z-20 rounded-lg border border-cu-border bg-cu-bg p-2 shadow-cu-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="date"
              defaultValue={task.dueDate?.slice(0, 10)}
              className="rounded-md border border-cu-border px-2 py-1 text-xs bg-cu-bg text-cu-text-primary"
              onChange={(e) => {
                void onUpdateDueDate?.(task.taskId, e.target.value || null);
                setDateOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom row: Priority badge & Multi-Assignee Avatar Stack */}
      <div className={`flex items-center justify-between mt-auto ${dense ? 'pt-1' : 'pt-1.5'}`}>
        <div className="flex items-center gap-1.5">
          {task.blocked && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500">
              <Lock size={10} className="flex-shrink-0" /> Blocked
            </span>
          )}
          {priorityStyle && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityStyle.bg} ${priorityStyle.text}`}>
              {priorityStyle.label}
            </span>
          )}
        </div>

        {/* Assignee Trigger & Popover */}
        <div className="relative" ref={assigneeRef} onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-cu-primary/20 transition-transform active:scale-95"
            onClick={handleOpenAssignee}
            aria-label="Edit assignees"
            title={assigneesList.map((a) => a.name).filter(Boolean).join(', ') || 'Unassigned'}
          >
            {assigneesList.length > 1 ? (
              <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                {assigneesList.slice(0, 3).map((assignee, idx) => (
                  <AssigneeAvatar
                    key={assignee.userId ?? idx}
                    name={assignee.name}
                    profilePicUrl={assignee.photoUrl}
                    size={22}
                    className="border-2 border-cu-bg ring-1 ring-cu-border shadow-xs"
                  />
                ))}
                {assigneesList.length > 3 && (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cu-primary/10 border-2 border-cu-bg ring-1 ring-cu-border text-[9px] font-bold text-cu-primary">
                    +{assigneesList.length - 3}
                  </span>
                )}
              </div>
            ) : assigneesList.length === 1 ? (
              <AssigneeAvatar
                name={assigneesList[0].name}
                profilePicUrl={assigneesList[0].photoUrl}
                size={24}
                className="border-2 border-cu-bg ring-1 ring-cu-border"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-cu-border text-cu-text-muted hover:border-cu-primary hover:text-cu-primary transition-colors">
                <UserPlus size={12} />
              </div>
            )}
          </button>

          {assigneeOpen && (
            <div
              className="absolute right-0 bottom-full mb-1.5 sm:bottom-auto sm:top-7 z-30 w-64 rounded-xl border border-cu-border bg-cu-bg p-2 shadow-cu-xl animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between border-b border-cu-border pb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cu-text-secondary">
                  {assignMode === 'multi' ? 'Multiple Assignees' : 'Assign To'}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      assignMode === 'single'
                        ? 'bg-cu-primary text-white shadow-xs'
                        : 'bg-cu-bg-secondary text-cu-text-secondary hover:text-cu-text-primary'
                    }`}
                    onClick={() => setAssignMode('single')}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      assignMode === 'multi'
                        ? 'bg-cu-primary text-white shadow-xs'
                        : 'bg-cu-bg-secondary text-cu-text-secondary hover:text-cu-text-primary'
                    }`}
                    onClick={() => setAssignMode('multi')}
                  >
                    Multi
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {teamMembers.length > 0 ? (
                  teamMembers.map((member) => {
                    const memberUserId = member.userId ?? member.id;
                    const isSelected = assignMode === 'multi'
                      ? multiSelected.includes(memberUserId)
                      : assigneesList.some((a) => a.userId === memberUserId || a.name === member.name);

                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                          isSelected
                            ? 'bg-cu-primary/10 text-cu-primary font-medium'
                            : 'text-cu-text-primary hover:bg-cu-hover'
                        }`}
                        onClick={() => {
                          if (assignMode === 'single') {
                            handleSingleAssign(member);
                          } else {
                            toggleMultiMember(member);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AssigneeAvatar
                            name={member.name}
                            profilePicUrl={member.photoUrl}
                            size={20}
                          />
                          <span className="truncate">{member.name}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-cu-primary flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })
                ) : (
                  <p className="py-2 text-center text-xs text-cu-text-muted">No team members found</p>
                )}
              </div>

              {assignMode === 'multi' && (
                <div className="mt-2 border-t border-cu-border pt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-cu-text-muted">
                    {multiSelected.length} selected
                  </span>
                  <button
                    type="button"
                    className="rounded-lg bg-cu-primary px-3 py-1 text-xs font-semibold text-white hover:bg-cu-primary-hover shadow-xs transition-colors"
                    onClick={handleMultiAssignApply}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
