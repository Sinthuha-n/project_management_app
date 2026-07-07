import type { CalendarEventItem } from '../types';
import {
  buildMonthGrid,
  eventOccursOnDay,
  getCalendarSummary,
  groupAgendaEvents,
  splitVisibleEvents,
  toDate,
  toDateKey,
} from './date';

const task = (overrides: Partial<CalendarEventItem>): CalendarEventItem => ({
  id: 'task-1',
  taskId: 1,
  title: 'Task',
  kind: 'task',
  status: 'To Do',
  ...overrides,
});

describe('calendar date utilities', () => {
  it('parses date-only values as local calendar dates', () => {
    const parsed = toDate('2026-04-03');

    expect(parsed).not.toBeNull();
    expect(toDateKey(parsed!)).toBe('2026-04-03');
  });

  it('builds a complete aligned month grid', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 15));

    expect(grid.length % 7).toBe(0);
    expect(toDateKey(grid[0])).toBe('2026-03-29');
    expect(toDateKey(grid[grid.length - 1])).toBe('2026-05-02');
  });

  it('includes events throughout their date range', () => {
    const event = task({ startDate: '2026-04-03', endDate: '2026-04-05' });

    expect(eventOccursOnDay(event, new Date(2026, 3, 4))).toBe(true);
    expect(eventOccursOnDay(event, new Date(2026, 3, 6))).toBe(false);
  });

  it('splits visible and hidden events', () => {
    const events = [1, 2, 3, 4].map((id) => task({ id: `task-${id}`, taskId: id }));

    const result = splitVisibleEvents(events, 3);

    expect(result.visible).toHaveLength(3);
    expect(result.hidden).toHaveLength(1);
  });

  it('summarizes visible calendar work', () => {
    const events: CalendarEventItem[] = [
      task({ id: 'task-overdue', taskId: 1, dueDate: '2026-04-01' }),
      task({ id: 'task-today', taskId: 2, dueDate: '2026-04-03', status: 'Done' }),
      { id: 'sprint-1', title: 'Sprint', kind: 'sprint', startDate: '2026-04-03', endDate: '2026-04-10' },
    ];

    expect(getCalendarSummary(events, new Date(2026, 3, 3))).toEqual({
      total: 3,
      scheduled: 3,
      overdue: 1,
      sprints: 1,
      today: 2,
    });
  });

  it('groups agenda events by urgency from the viewed date', () => {
    const events: CalendarEventItem[] = [
      task({ id: 'overdue', taskId: 1, dueDate: '2026-04-01' }),
      task({ id: 'today', taskId: 2, dueDate: '2026-04-03' }),
      task({ id: 'tomorrow', taskId: 3, dueDate: '2026-04-04' }),
      task({ id: 'later', taskId: 4, dueDate: '2026-04-20' }),
    ];

    const groups = groupAgendaEvents(events, new Date(2026, 3, 3));

    expect(groups.find((group) => group.key === 'overdue')?.events).toHaveLength(1);
    expect(groups.find((group) => group.key === 'today')?.events).toHaveLength(1);
    expect(groups.find((group) => group.key === 'tomorrow')?.events).toHaveLength(1);
    expect(groups.find((group) => group.key === 'later')?.events).toHaveLength(1);
  });
});
