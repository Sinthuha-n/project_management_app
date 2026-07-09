import { render, screen } from '@testing-library/react';
import MonthCalendarView from './MonthCalendarView';
import type { CalendarEventItem } from '../types';

const makeEvent = (id: number): CalendarEventItem => ({
  id: `task-${id}`,
  taskId: id,
  title: `Task ${id}`,
  kind: 'task',
  status: 'To Do',
  dueDate: '2026-04-03',
});

describe('MonthCalendarView', () => {
  it('renders an aligned seven-column calendar grid with overflow', () => {
    render(
      <MonthCalendarView
        currentDate={new Date(2026, 3, 15)}
        events={[makeEvent(1), makeEvent(2), makeEvent(3), makeEvent(4)]}
      />
    );

    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    expect(screen.getAllByText(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/)).toHaveLength(7);
    const days = screen.getAllByTestId('calendar-day');
    expect(days).toHaveLength(35);
    expect(days[0]).toHaveAttribute('data-date', '2026-03-29');
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });
});
