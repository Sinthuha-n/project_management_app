import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TimelineView from './TimelineView';
import { updateTaskDates } from '../api';
import { toast } from '@/components/ui';
import type { Task } from '../types';

jest.mock('../api', () => ({
  updateTaskDates: jest.fn(),
}));

jest.mock('@/components/ui', () => ({
  toast: jest.fn(),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/shared/BottomSheet', () => ({
  __esModule: true,
  default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null
  ),
}));

const mockedUpdateTaskDates = updateTaskDates as jest.Mock;
const mockedToast = toast as unknown as jest.Mock;

import { format, addDays } from 'date-fns';

const today = new Date();
const tasks: Task[] = [
  {
    id: 1,
    title: 'Build API',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
    dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    assigneeName: 'Asha',
  },
  {
    id: 2,
    title: 'Write launch notes',
    status: 'TODO',
    priority: 'LOW',
    assigneeName: 'Ben',
  },
];

describe('TimelineView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpdateTaskDates.mockImplementation((taskId: number, startDate?: string | null, dueDate?: string | null) => (
      Promise.resolve({ id: taskId, startDate, dueDate })
    ));
  });

  it('renders scheduled work and lets unscheduled tasks be scheduled from the tray', async () => {
    const onTaskUpdated = jest.fn();

    render(<TimelineView tasks={tasks} onTaskUpdated={onTaskUpdated} />);

    expect(screen.getAllByText('Build API').length).toBeGreaterThan(0);
    expect(screen.getByText('Unscheduled work')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule today' }));

    await waitFor(() => {
      expect(mockedUpdateTaskDates).toHaveBeenCalledWith(
        2,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });
    expect(onTaskUpdated).toHaveBeenCalledWith(2, expect.objectContaining({
      startDate: expect.any(String),
      dueDate: expect.any(String),
    }));
    expect(mockedToast).toHaveBeenCalledWith('Task scheduled on the timeline.', 'success');
  });

  it('shows a filtered empty state and can clear filters', () => {
    render(<TimelineView tasks={tasks} />);

    fireEvent.change(screen.getByPlaceholderText('Search tasks, assignees, milestones'), {
      target: { value: 'does-not-exist' },
    });

    expect(screen.getByText('No scheduled work matches your filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByText('Build API').length).toBeGreaterThan(0);
  });

  it('groups scheduled tasks and persists drag date updates', async () => {
    render(<TimelineView tasks={tasks} />);

    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'status' } });
    expect(screen.getAllByRole('button', { name: /IN PROGRESS/ }).length).toBeGreaterThan(0);

    const bar = document.querySelector('[title="Build API - drag to move"]');
    expect(bar).not.toBeNull();

    fireEvent.mouseDown(bar!, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 138 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(mockedUpdateTaskDates).toHaveBeenCalledWith(
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });
    expect(mockedToast).toHaveBeenCalledWith('Timeline dates updated.', 'success');
  });
});
