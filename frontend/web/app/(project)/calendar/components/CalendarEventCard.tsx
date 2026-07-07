import { CalendarDays, CircleDot, Flag, UserRound } from 'lucide-react';
import type { CalendarEventItem } from '../types';
import { getEventEndDate, getEventStartDate, isSameDay } from '../utils/date';

interface CalendarEventCardProps {
  event: CalendarEventItem;
  compact?: boolean;
  onClick?: (event: CalendarEventItem, clientX: number, clientY: number) => void;
  onDragStart?: (eventId: string) => void;
  isDragging?: boolean;
}

const statusTone = (status?: string) => {
  const normalized = (status || '').toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'border-cu-success/25 bg-cu-success-light text-cu-success';
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'border-cu-primary/25 bg-cu-primary-light text-cu-primary';
  if (normalized === 'IN_REVIEW') return 'border-amber-400/30 bg-amber-400/15 text-amber-600';
  return 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary';
};

const formatShortDate = (date: Date | null) =>
  date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? null;

export default function CalendarEventCard({
  event,
  compact = false,
  onClick,
  onDragStart,
  isDragging = false,
}: CalendarEventCardProps) {
  const sprint = event.kind === 'sprint';
  const draggable = !sprint && event.taskId != null;
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  const dateLabel = start && end && !isSameDay(start, end)
    ? `${formatShortDate(start)} - ${formatShortDate(end)}`
    : formatShortDate(start || end);
  const tone = sprint
    ? 'border-cu-primary/30 bg-cu-primary-light text-cu-primary'
    : statusTone(event.status);
  const Icon = sprint ? Flag : CircleDot;

  return (
    <div
      title={`${event.title}${event.status ? ` - ${event.status}` : ''}`}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => { e.stopPropagation(); onDragStart(event.id); } : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(event, e.clientX, e.clientY); } : undefined}
      className={[
        'group flex min-h-7 w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-semibold shadow-cu-sm transition-all',
        tone,
        onClick ? 'cursor-pointer hover:-translate-y-px hover:shadow-cu-md' : '',
        draggable ? 'cursor-grab active:cursor-grabbing' : '',
        isDragging ? 'opacity-45' : '',
      ].join(' ')}
    >
      <Icon size={12} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {!compact && event.assignee && (
        <span className="hidden max-w-[7rem] items-center gap-1 truncate rounded bg-cu-bg/70 px-1.5 py-0.5 text-[10px] font-medium text-cu-text-secondary lg:inline-flex">
          <UserRound size={10} className="shrink-0" />
          <span className="truncate">{event.assignee}</span>
        </span>
      )}
      {!compact && dateLabel && (
        <span className="hidden items-center gap-1 whitespace-nowrap rounded bg-cu-bg/70 px-1.5 py-0.5 text-[10px] font-medium text-cu-text-secondary xl:inline-flex">
          <CalendarDays size={10} />
          {dateLabel}
        </span>
      )}
    </div>
  );
}
