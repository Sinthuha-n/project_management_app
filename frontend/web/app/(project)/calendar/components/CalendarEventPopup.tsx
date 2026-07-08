'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, ExternalLink, Flag, UserRound, X } from 'lucide-react';
import type { CalendarEventItem } from '../types';
import { getEventEndDate, getEventStartDate, isSameDay } from '../utils/date';

interface CalendarEventPopupProps {
  event: CalendarEventItem;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenTask?: (taskId: number) => void;
}

const statusTone = (status?: string) => {
  const normalized = (status || '').toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'bg-cu-success-light text-cu-success';
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'bg-cu-primary-light text-cu-primary';
  if (normalized === 'IN_REVIEW') return 'bg-amber-400/15 text-amber-600';
  return 'bg-cu-bg-tertiary text-cu-text-secondary';
};

const formatDate = (date: Date | null) =>
  date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? null;

export default function CalendarEventPopup({ event, position, onClose, onOpenTask }: CalendarEventPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  const dateLabel = start && end && !isSameDay(start, end)
    ? `${formatDate(start)} - ${formatDate(end)}`
    : formatDate(start || end);

  const coordinates = useMemo(() => {
    if (typeof window === 'undefined') return { left: position.x, top: position.y + 10 };

    const width = 320;
    const height = 280;
    return {
      left: Math.max(8, Math.min(position.x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(position.y + 10, window.innerHeight - height - 8)),
    };
  }, [position.x, position.y]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onMouseDown), 50);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={event.title}
      style={{ position: 'fixed', left: coordinates.left, top: coordinates.top, width: 320, zIndex: 200 }}
      className="overflow-hidden rounded-xl glass-panel shadow-cu-xl"
    >
      <div className="flex items-start gap-3 border-b border-[rgba(232,232,237,0.3)] dark:border-[rgba(39,52,73,0.3)] bg-[rgba(247,248,250,0.3)] dark:bg-[rgba(17,24,39,0.3)] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(255,255,255,0.4)] dark:bg-[rgba(11,17,32,0.4)] text-cu-primary backdrop-blur-sm">
          {event.kind === 'sprint' ? <Flag size={16} /> : <CalendarDays size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-cu-text-primary">{event.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-cu-bg-tertiary px-2 py-0.5 text-[10px] font-bold uppercase text-cu-text-secondary">
              {event.kind === 'sprint' ? 'Sprint' : event.type || 'Task'}
            </span>
            {event.status && (
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(event.status)}`}>
                {event.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close event details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover/40 hover:text-cu-text-primary"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        {dateLabel && (
          <div className="flex items-center gap-2 text-xs text-cu-text-secondary">
            <CalendarDays size={14} className="text-cu-text-muted" />
            <span>{dateLabel}</span>
          </div>
        )}
        {event.assignee && (
          <div className="flex items-center gap-2 text-xs text-cu-text-secondary">
            <UserRound size={14} className="text-cu-text-muted" />
            <span className="truncate">{event.assignee}</span>
          </div>
        )}
        {event.description && (
          <p className="line-clamp-4 rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.2)] dark:bg-[rgba(17,24,39,0.2)] px-3 py-2 text-xs leading-relaxed text-cu-text-secondary">
            {event.description}
          </p>
        )}
      </div>

      {event.taskId && onOpenTask && (
        <div className="border-t border-[rgba(232,232,237,0.3)] dark:border-[rgba(39,52,73,0.3)] bg-[rgba(247,248,250,0.3)] dark:bg-[rgba(17,24,39,0.3)] px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenTask(event.taskId!)}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg liquid-glass-btn px-3 text-xs font-bold text-white transition-colors"
          >
            <ExternalLink size={13} />
            Open task
          </button>
        </div>
      )}
    </div>
  );
}
