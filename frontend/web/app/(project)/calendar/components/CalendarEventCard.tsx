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
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'border-[rgba(107,201,80,0.3)] bg-[rgba(107,201,80,0.12)] text-cu-success backdrop-blur-md';
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'border-[rgba(21,93,252,0.3)] bg-[rgba(21,93,252,0.12)] text-cu-primary backdrop-blur-md';
  if (normalized === 'IN_REVIEW') return 'border-[rgba(255,159,67,0.3)] bg-[rgba(255,159,67,0.12)] text-amber-600 dark:text-amber-400 backdrop-blur-md';
  return 'border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] text-cu-text-secondary backdrop-blur-md';
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
    ? 'border-[rgba(21,93,252,0.3)] bg-[rgba(21,93,252,0.12)] text-cu-primary backdrop-blur-md'
    : statusTone(event.status);
  const Icon = sprint ? Flag : CircleDot;

  return (
    <div
      title={`${event.title}${event.status ? ` - ${event.status}` : ''}`}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => { e.stopPropagation(); onDragStart(event.id); } : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(event, e.clientX, e.clientY); } : undefined}
      className={[
        'group relative flex min-h-7 w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-semibold shadow-cu-sm transition-all liquid-glass-interactive',
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
