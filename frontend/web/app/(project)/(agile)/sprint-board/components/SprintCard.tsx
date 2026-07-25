'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SprintboardTask } from '../types';
import { Calendar, GripVertical, Lock } from 'lucide-react';
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
  const [dateOpen, setDateOpen] = React.useState(false);
  const [assigneeOpen, setAssigneeOpen] = React.useState(false);
  const [assignMode, setAssignMode] = React.useState<'single' | 'multi'>('single');
  const [multiSelected, setMultiSelected] = React.useState<number[]>([]);
  const [assigning, setAssigning] = React.useState(false);

  const currentAssignee = teamMembers.find((member) => member.name === task.assigneeName);
  const displayKey = projectKey && task.projectTaskNumber
    ? `#${projectKey}-${task.projectTaskNumber}`
    : `#${task.taskId}`;

  const toggleMultiMember = (member: SprintTeamMemberOption) => {
    const memberUserId = member.userId ?? member.id;
    setMultiSelected((prev) =>
      prev.includes(memberUserId) ? prev.filter((id) => id !== memberUserId) : [...prev, memberUserId]
    );
  };

  const applyMultiAssign = async () => {
    if (!onAssignMultiple) return;
    setAssigning(true);
    try {
      await onAssignMultiple(task.taskId, multiSelected);
      setAssigneeOpen(false);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        rounded-xl border bg-cu-bg shadow-cu-sm
        hover:shadow-cu-md hover:border-cu-primary/30 transition-all duration-200 cursor-grab active:cursor-grabbing
        focus-within:ring-2 focus-within:ring-[var(--cu-focus-ring)]
        ${dense ? 'p-2.5' : 'p-3'}
        ${selected ? 'border-cu-primary ring-2 ring-cu-primary/20' : 'border-cu-border'}
        ${isDragging ? 'ring-2 ring-cu-primary z-50 scale-[1.02]' : ''}
      `}
    >
      <div className="mb-2 flex items-center justify-between">
        <label
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-cu-text-muted"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect?.(task.taskId, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-cu-border text-cu-primary focus:ring-cu-primary"
          />
        </label>
        <div className="flex items-center gap-1 text-[10px] text-cu-text-muted">
          <span className="rounded-md border border-cu-border bg-cu-bg-secondary px-1.5 py-0.5 font-semibold text-cu-text-secondary">
            {displayKey}
          </span>
        </div>
      </div>
      {/* Title — click to open task modal */}
      <div className={`flex items-start gap-1.5 ${dense ? 'mb-2' : 'mb-2.5'}`}>
        <GripVertical size={14} className="text-cu-text-muted/40 mt-0.5 flex-shrink-0" />
        <h3
          className={`font-semibold text-cu-text-primary leading-tight cursor-pointer hover:text-cu-primary transition-colors flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-cu-primary/20 rounded ${dense ? 'text-[13px]' : 'text-[14px]'}`}
          onClick={(e) => { e.stopPropagation(); onOpenTask?.(task.taskId); }}
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
      <div className={`relative flex items-center gap-2 text-[11px] font-medium text-cu-text-secondary ${dense ? 'mb-2' : 'mb-3'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDateOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-cu-primary/10"
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

      {/* Bottom row: Priority badge, Story points & Assignee */}
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
        
        <div className="relative">
          <button
            type="button"
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
            onClick={(e) => {
              e.stopPropagation();
              setAssigneeOpen((prev) => !prev);
            }}
            aria-label="Edit assignee"
          >
            {task.assigneeName ? (
              <AssigneeAvatar
                name={task.assigneeName}
                profilePicUrl={task.assigneePhotoUrl}
                size={24}
                className="border-2 border-cu-bg ring-1 ring-cu-border"
              />
            ) : (
              <span className="text-[10px] text-cu-text-muted font-medium">Unassigned</span>
            )}
          </button>
          {assigneeOpen && (
            <div
              className="absolute right-0 top-7 z-20 w-64 rounded-xl border border-cu-border bg-cu-bg p-2 shadow-cu-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cu-text-muted">Assignees</p>
                <div className="flex gap-1">
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-[10px] ${assignMode === 'single' ? 'bg-cu-primary/10 text-cu-primary' : 'bg-cu-bg-secondary text-cu-text-primary'}`}
                  onClick={() => {
                    setAssignMode('single');
                    setMultiSelected([]);
                  }}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-[10px] ${assignMode === 'multi' ? 'bg-cu-primary/10 text-cu-primary' : 'bg-cu-bg-secondary text-cu-text-primary'}`}
                  onClick={() => setAssignMode('multi')}
                >
                  Multi
                </button>
                </div>
              </div>
              <div className="max-h-40 overflow-auto space-y-1">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`w-full rounded-md px-2 py-1 text-left text-xs hover:bg-cu-hover ${
                      assignMode === 'multi' && multiSelected.includes(member.userId ?? member.id)
                        ? 'bg-cu-primary/5 text-cu-primary'
                        : 'text-cu-text-primary'
                    }`}
                    onClick={async () => {
                      if (assignMode === 'single') {
                        if (!onAssignSingle) return;
                        setAssigning(true);
                        try {
                          await onAssignSingle(task.taskId, member.userId ?? member.id);
                        } finally {
                          setAssigning(false);
                        }
                        setAssigneeOpen(false);
                        return;
                      }
                      toggleMultiMember(member);
                    }}
                    disabled={assigning}
                  >
                    <span>{member.name}{currentAssignee?.id === member.id ? ' (current)' : ''}</span>
                  </button>
                ))}
              </div>
              {assignMode === 'multi' && (
                <button
                  type="button"
                  className="mt-2 w-full rounded-md bg-cu-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  onClick={() => void applyMultiAssign()}
                  disabled={assigning}
                >
                  {assigning ? 'Applying...' : 'Apply'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
