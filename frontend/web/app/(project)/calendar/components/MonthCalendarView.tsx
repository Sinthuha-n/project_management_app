'use client';

import { useState } from 'react';
import CalendarEventCard from './CalendarEventCard';
import CalendarEventPopup from './CalendarEventPopup';
import type { CalendarEventItem } from '../types';
import {
  DAY_NAMES,
  buildMonthGrid,
  getEventsForDay,
  isToday,
  splitVisibleEvents,
  toDateKey,
} from '../utils/date';

interface MonthCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onDayClick?: (date: Date) => void;
  onEventDrop?: (eventId: string, newDate: Date) => void;
  onOpenTask?: (taskId: number) => void;
}

const VISIBLE_EVENTS_PER_DAY = 3;

export default function MonthCalendarView({
  currentDate,
  events,
  onDayClick,
  onEventDrop,
  onOpenTask,
}: MonthCalendarViewProps) {
  const [popup, setPopup] = useState<{ event: CalendarEventItem; x: number; y: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const days = buildMonthGrid(currentDate);

  return (
    <section className="overflow-hidden rounded-xl glass-panel shadow-cu-sm" data-testid="month-view">
      <div className="grid grid-cols-7 border-b border-[rgba(232,232,237,0.4)] dark:border-[rgba(39,52,73,0.4)] bg-[rgba(247,248,250,0.3)] dark:bg-[rgba(17,24,39,0.3)]">
        {DAY_NAMES.map((name) => (
          <div key={name} className="px-2 py-2 text-center text-[11px] font-bold uppercase text-cu-text-secondary sm:px-3">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === currentDate.getMonth();
          const dayEvents = getEventsForDay(events, day);
          const { visible, hidden } = splitVisibleEvents(dayEvents, VISIBLE_EVENTS_PER_DAY);
          const target = dropTargetKey === key;
          const today = isToday(day);

          return (
            <div
              key={key}
              data-testid="calendar-day"
              data-date={key}
              className={[
                'group min-h-[118px] border-b border-r border-[rgba(232,232,237,0.3)] dark:border-[rgba(39,52,73,0.3)] p-2 transition-colors sm:min-h-[142px] sm:p-2.5',
                inMonth ? 'bg-transparent' : 'bg-[rgba(247,248,250,0.2)] dark:bg-[rgba(17,24,39,0.2)] text-cu-text-muted',
                day.getDay() === 0 || day.getDay() === 6 ? 'bg-[rgba(247,248,250,0.1)] dark:bg-[rgba(17,24,39,0.1)]' : '',
                onDayClick ? 'cursor-pointer hover:bg-[rgba(245,247,250,0.4)] dark:hover:bg-[rgba(24,34,53,0.4)]' : '',
                target ? 'bg-[rgba(235,242,255,0.5)] dark:bg-[rgba(26,47,92,0.5)] ring-2 ring-inset ring-cu-primary/30' : '',
              ].join(' ')}
              onClick={() => onDayClick?.(day)}
              onDragOver={(event) => {
                if (!draggedId) return;
                event.preventDefault();
                setDropTargetKey(key);
              }}
              onDragLeave={() => setDropTargetKey(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedId) onEventDrop?.(draggedId, day);
                setDraggedId(null);
                setDropTargetKey(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={[
                    'flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums',
                    today ? 'bg-cu-primary text-white' : inMonth ? 'text-cu-text-primary' : 'text-cu-text-muted',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="hidden rounded bg-cu-bg-tertiary px-1.5 py-0.5 text-[10px] font-bold text-cu-text-muted sm:inline">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {visible.map((event) => (
                  <CalendarEventCard
                    key={`${event.id}-${key}`}
                    event={event}
                    compact
                    onClick={(selectedEvent, x, y) => setPopup({ event: selectedEvent, x, y })}
                    onDragStart={setDraggedId}
                    isDragging={draggedId === event.id}
                  />
                ))}
                {hidden.length > 0 && (
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="h-7 w-full rounded-md border border-dashed border-cu-border bg-cu-bg-secondary px-2 text-left text-[11px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover"
                    title={hidden.map((event) => event.title).join(', ')}
                  >
                    +{hidden.length} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {popup && (
        <CalendarEventPopup
          event={popup.event}
          position={{ x: popup.x, y: popup.y }}
          onClose={() => setPopup(null)}
          onOpenTask={onOpenTask}
        />
      )}
    </section>
  );
}
