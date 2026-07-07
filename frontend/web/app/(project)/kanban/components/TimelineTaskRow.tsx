'use client';

import React from 'react';
import { format, isWeekend } from 'date-fns';
import { AlertTriangle, CalendarDays, Diamond, GitBranch, Lock, User } from 'lucide-react';
import { Milestone } from './TimelineView';
import type { TimelineTaskModel } from '../utils/timeline-utils';
import { statusLabel } from '../utils/timeline-utils';

const statusColors = {
  TODO: { bar: 'bg-slate-500 hover:bg-slate-600', badge: 'bg-cu-bg-tertiary text-cu-text-secondary border-cu-border' },
  IN_PROGRESS: { bar: 'bg-blue-600 hover:bg-blue-700', badge: 'bg-blue-100 text-blue-700 border-blue-300' },
  IN_REVIEW: { bar: 'bg-amber-500 hover:bg-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  DONE: { bar: 'bg-emerald-600 hover:bg-emerald-700', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const priorityAccent = {
  LOW: 'border-l-emerald-400',
  MEDIUM: 'border-l-amber-400',
  HIGH: 'border-l-orange-500',
  URGENT: 'border-l-red-500',
};

interface TimelineTaskRowProps {
  task: TimelineTaskModel;
  visibleDays: Date[];
  dayColumnWidth: number;
  timelineWidthPx: number;
  todayOffset: number;
  milestones: Milestone[];
  isDragging: boolean;
  onOpenTask?: (taskId: number) => void;
  onStartDragMove: (e: React.MouseEvent, task: TimelineTaskModel) => void;
  onStartDragResize: (e: React.MouseEvent, task: TimelineTaskModel) => void;
  activeDragTaskId?: number;
}

export default function TimelineTaskRow({
  task,
  visibleDays,
  dayColumnWidth,
  timelineWidthPx,
  todayOffset,
  milestones,
  isDragging,
  onOpenTask,
  onStartDragMove,
  onStartDragResize,
  activeDragTaskId,
}: TimelineTaskRowProps) {
  const statusTheme = statusColors[task.status as keyof typeof statusColors] ?? statusColors.TODO;
  const accent = priorityAccent[task.priority as keyof typeof priorityAccent] ?? 'border-l-cu-border';
  const matchedMilestone = task.milestoneId != null ? milestones.find((milestone) => milestone.id === task.milestoneId) : null;
  const dateText = `${format(task.startDateObj, 'MMM d')} - ${format(task.dueDateObj, 'MMM d')}`;

  return (
    <div className="flex min-h-[72px] border-b border-cu-border-light bg-cu-bg hover:bg-cu-hover/60">
      <button
        type="button"
        className={`sticky left-0 z-10 w-[320px] flex-shrink-0 border-l-4 ${accent} border-r border-cu-border bg-cu-bg/95 px-3 py-2.5 text-left backdrop-blur transition-colors hover:bg-cu-hover`}
        onClick={() => onOpenTask?.(task.id)}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-cu-text-primary">{task.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusTheme.badge}`}>
                {statusLabel(task.status)}
              </span>
              {task.priority && (
                <span className="rounded-md border border-cu-border bg-cu-bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-cu-text-secondary">
                  {task.priority}
                </span>
              )}
              {task.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                  <Lock size={10} />
                  Blocked
                </span>
              )}
              {task.isPastMilestone && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                  <AlertTriangle size={10} />
                  Milestone risk
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-cu-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {dateText} ({task.durationDays}d)
          </span>
          <span className="inline-flex items-center gap-1">
            <User size={12} />
            {task.assigneeName || 'Unassigned'}
          </span>
          {matchedMilestone && (
            <span className="inline-flex min-w-0 items-center gap-1 text-purple-600">
              <Diamond size={11} className="fill-current" />
              <span className="max-w-[10rem] truncate">{matchedMilestone.name}</span>
            </span>
          )}
          {task.githubIssueNumber && (
            <span className="inline-flex items-center gap-1">
              <GitBranch size={12} />
              #{task.githubIssueNumber}
            </span>
          )}
        </div>
      </button>

      <div className="relative" style={{ width: `${timelineWidthPx}px`, minHeight: '72px' }}>
        {visibleDays.map((day, index) => (
          <div
            key={`grid-${task.id}-${day.toISOString()}`}
            className={[
              'absolute top-0 h-full border-r border-cu-border-light',
              isWeekend(day) ? 'bg-cu-bg-secondary/70' : 'bg-cu-bg',
            ].join(' ')}
            style={{ left: `${index * dayColumnWidth}px`, width: `${dayColumnWidth}px` }}
          />
        ))}

        {todayOffset >= 0 && todayOffset < visibleDays.length && (
          <div
            className="absolute top-0 z-[5] h-full w-[2px] bg-red-400/80"
            style={{ left: `${todayOffset * dayColumnWidth}px` }}
          />
        )}

        {matchedMilestone?.dueDate ? (() => {
          const milestoneIndex = visibleDays.findIndex((day) => format(day, 'yyyy-MM-dd') === matchedMilestone.dueDate);
          if (milestoneIndex < 0) return null;
          return (
            <div
              className="absolute top-2 z-[6] flex flex-col items-center"
              style={{ left: `${milestoneIndex * dayColumnWidth + dayColumnWidth / 2 - 6}px` }}
              title={`Milestone: ${matchedMilestone.name}`}
            >
              <Diamond size={12} className="fill-purple-500 text-purple-500" />
            </div>
          );
        })() : null}

        <div
          className={[
            'absolute top-1/2 h-9 -translate-y-1/2 select-none rounded-lg text-xs font-bold text-white shadow-cu-sm transition-all',
            statusTheme.bar,
            task.isOverdue ? 'ring-2 ring-red-300' : '',
            task.isPastMilestone ? 'outline outline-2 outline-amber-300' : '',
            isDragging ? 'opacity-80 shadow-cu-lg' : '',
          ].join(' ')}
          style={{ left: `${task.leftPx + 3}px`, width: `${task.widthPx}px`, cursor: 'grab' }}
          onMouseDown={(event) => onStartDragMove(event, task)}
          onClick={() => { if (!activeDragTaskId) onOpenTask?.(task.id); }}
          title={`${task.title} - drag to move`}
        >
          <span className="flex h-full items-center gap-1.5 truncate px-2">
            {task.isBlocked && <Lock size={11} className="flex-shrink-0" />}
            <span className="truncate">{task.title}</span>
          </span>
          <div
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-lg hover:bg-white/20"
            onMouseDown={(event) => {
              event.stopPropagation();
              onStartDragResize(event, task);
            }}
            title="Drag to resize"
          />
        </div>
      </div>
    </div>
  );
}
