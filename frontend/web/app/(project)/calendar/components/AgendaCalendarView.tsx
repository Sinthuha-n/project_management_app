'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Flag, UserRound } from 'lucide-react';
import CalendarEventPopup from './CalendarEventPopup';
import type { CalendarEventItem } from '../types';
import { getEventEndDate, getEventStartDate, groupAgendaEvents, isSameDay } from '../utils/date';

interface AgendaCalendarViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onOpenTask?: (taskId: number) => void;
}

const groupIcon = (key: string) => {
  if (key === 'overdue') return AlertTriangle;
  if (key === 'today') return Clock;
  if (key === 'tomorrow') return CalendarDays;
  if (key === 'this-week') return CheckCircle2;
  return Flag;
};

const statusTone = (status?: string) => {
  const normalized = (status || '').toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'bg-cu-success-light text-cu-success';
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'bg-cu-primary-light text-cu-primary';
  if (normalized === 'IN_REVIEW') return 'bg-amber-400/15 text-amber-600';
  return 'bg-cu-bg-tertiary text-cu-text-secondary';
};

const formatRange = (event: CalendarEventItem) => {
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  const format = (date: Date | null) => date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? '';

  if (start && end && !isSameDay(start, end)) return `${format(start)} - ${format(end)}`;
  return format(start || end);
};

export default function AgendaCalendarView({ currentDate, events, onOpenTask }: AgendaCalendarViewProps) {
  const [popup, setPopup] = useState<{ event: CalendarEventItem; x: number; y: number } | null>(null);
  const groups = groupAgendaEvents(events, currentDate).filter((group) => group.events.length > 0);

  if (groups.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-cu-border bg-cu-bg px-6 py-16 text-center shadow-cu-sm">
        <CalendarDays className="mx-auto mb-3 text-cu-text-muted" size={28} />
        <p className="text-sm font-bold text-cu-text-primary">No scheduled work</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-cu-text-secondary">
          Add start or due dates to tasks and sprints to build a useful project agenda.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="agenda-view">
      {groups.map((group) => {
        const Icon = groupIcon(group.key);

        return (
          <div key={group.key} className="overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm">
            <div className="flex items-center justify-between gap-3 border-b border-cu-border bg-cu-bg-secondary px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon size={16} className={group.key === 'overdue' ? 'text-cu-danger' : 'text-cu-primary'} />
                <h2 className="text-sm font-bold text-cu-text-primary">{group.label}</h2>
              </div>
              <span className="rounded-md bg-cu-bg px-2 py-1 text-[11px] font-bold text-cu-text-secondary">
                {group.events.length}
              </span>
            </div>

            <div className="divide-y divide-cu-border">
              {group.events.map((event) => (
                <button
                  type="button"
                  key={`${group.key}-${event.id}`}
                  onClick={(clickEvent) => setPopup({ event, x: clickEvent.clientX, y: clickEvent.clientY })}
                  className="grid w-full grid-cols-1 gap-3 px-4 py-3 text-left transition-colors hover:bg-cu-hover sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${event.kind === 'sprint' ? 'bg-cu-primary' : 'bg-cu-text-muted'}`} />
                      <p className="truncate text-sm font-bold text-cu-text-primary">{event.title}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-cu-bg-tertiary px-2 py-0.5 text-[10px] font-bold uppercase text-cu-text-secondary">
                        {event.kind === 'sprint' ? 'Sprint' : event.type || 'Task'}
                      </span>
                      {event.status && (
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(event.status)}`}>
                          {event.status.replace(/_/g, ' ')}
                        </span>
                      )}
                      {event.assignee && (
                        <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md bg-cu-bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-cu-text-secondary">
                          <UserRound size={10} />
                          <span className="truncate">{event.assignee}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-cu-text-secondary sm:justify-end">
                    <CalendarDays size={13} className="text-cu-text-muted" />
                    <span>{formatRange(event)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

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
