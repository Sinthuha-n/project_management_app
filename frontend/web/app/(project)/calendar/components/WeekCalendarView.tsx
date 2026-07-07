'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CalendarEventCard from './CalendarEventCard';
import CalendarEventPopup from './CalendarEventPopup';
import type { CalendarEventItem } from '../types';
import { DAY_NAMES, addDays, getEventsForDay, isToday, startOfWeek, toDateKey } from '../utils/date';

interface WeekCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onDayClick?: (date: Date) => void;
  onEventDrop?: (eventId: string, newDate: Date) => void;
  onOpenTask?: (taskId: number) => void;
}

export default function WeekCalendarView({ currentDate, events, onDayClick, onEventDrop, onOpenTask }: WeekCalendarViewProps) {
  const start = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ event: CalendarEventItem; x: number; y: number } | null>(null);

  return (
    <section className="overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm" data-testid="week-view">
      <div className="custom-scrollbar overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-7">
          {weekDays.map((day, index) => {
            const key = toDateKey(day);
            const dayEvents = getEventsForDay(events, day);
            const target = dropTargetDate === key;
            const today = isToday(day);

            return (
              <div
                key={key}
                className={[
                  'min-h-[520px] border-r border-cu-border last:border-r-0',
                  day.getDay() === 0 || day.getDay() === 6 ? 'bg-cu-bg-secondary/60' : 'bg-cu-bg',
                  target ? 'bg-cu-primary-light' : '',
                ].join(' ')}
                onDragOver={(event) => {
                  if (!draggedId) return;
                  event.preventDefault();
                  setDropTargetDate(key);
                }}
                onDragLeave={() => setDropTargetDate(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId) onEventDrop?.(draggedId, day);
                  setDraggedId(null);
                  setDropTargetDate(null);
                }}
              >
                <button
                  type="button"
                  onClick={() => onDayClick?.(day)}
                  className={[
                    'sticky top-0 z-10 flex min-h-[72px] w-full items-center justify-between gap-3 border-b border-cu-border bg-cu-bg/95 px-3 py-3 text-left backdrop-blur',
                    today ? 'text-cu-primary' : 'text-cu-text-primary',
                  ].join(' ')}
                >
                  <span>
                    <span className="block text-[11px] font-bold uppercase text-cu-text-muted">{DAY_NAMES[index]}</span>
                    <span className="mt-1 block text-lg font-bold tabular-nums">{day.getDate()}</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cu-border bg-cu-bg-secondary text-cu-text-muted transition-colors group-hover:text-cu-primary">
                    <Plus size={14} />
                  </span>
                </button>

                <div className="space-y-2 p-2.5">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <CalendarEventCard
                        key={`${event.id}-${key}`}
                        event={event}
                        onClick={(selectedEvent, x, y) => setPopup({ event: selectedEvent, x, y })}
                        onDragStart={setDraggedId}
                        isDragging={draggedId === event.id}
                      />
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDayClick?.(day)}
                      className="flex min-h-[88px] w-full items-center justify-center rounded-lg border border-dashed border-cu-border bg-cu-bg-secondary/70 px-3 text-center text-xs font-semibold text-cu-text-muted transition-colors hover:border-cu-primary/30 hover:bg-cu-primary-light hover:text-cu-primary"
                    >
                      Add scheduled work
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
