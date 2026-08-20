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

  it('shows every unscheduled project task from backlog and board in the timeline tray', () => {
    const unscheduledOnly = Array.from({ length: 10 }, (_, index) => ({
      id: index + 10,
      title: `Backlog task ${index + 1}`,
      status: 'TODO',
      priority: 'MEDIUM',
    }));

    render(<TimelineView tasks={unscheduledOnly} />);

    expect(screen.getByText('10 tasks')).toBeInTheDocument();
    unscheduledOnly.forEach((task) => {
      expect(screen.getByText(task.title)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Showing 8 of/)).not.toBeInTheDocument();
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

  it('only exposes the due date resize handle on timeline bars', async () => {
    render(<TimelineView tasks={tasks} />);

    expect(screen.queryByTitle('Drag to resize start')).not.toBeInTheDocument();
    expect(screen.getByTitle('Drag to resize due date')).toBeInTheDocument();
  });

  it('persists due date resize updates from the end handle', async () => {
    render(<TimelineView tasks={tasks} />);

    const dueHandle = screen.getByTitle('Drag to resize due date');
    fireEvent.mouseDown(dueHandle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 138 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(mockedUpdateTaskDates).toHaveBeenCalledWith(
        1,
        undefined,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });
  });

  it('paginates scheduled tasks and navigates across pages', () => {
    const manyScheduledTasks: Task[] = Array.from({ length: 25 }, (_, index) => ({
      id: index + 100,
      title: `Scheduled task ${index + 1}`,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      startDate: format(addDays(today, -2), 'yyyy-MM-dd'),
      dueDate: format(addDays(today, 2), 'yyyy-MM-dd'),
      assigneeName: 'Developer',
    }));

    render(<TimelineView tasks={manyScheduledTasks} />);

    // Total count shows 25 scheduled
    expect(screen.getByText('25 scheduled')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Timeline pagination' })).toBeInTheDocument();

    // Page 1 shows first 10 tasks
    expect(screen.getAllByText('Scheduled task 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scheduled task 10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Scheduled task 11')).not.toBeInTheDocument();

    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: /^Page 2$/i }));

    expect(screen.queryByText('Scheduled task 1')).not.toBeInTheDocument();
    expect(screen.getAllByText('Scheduled task 11').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scheduled task 20').length).toBeGreaterThan(0);

    // Change tasks per page to 50
    const select = screen.getByRole('combobox', { name: /Tasks per page/i });
    fireEvent.change(select, { target: { value: '50' } });

    // Now all 25 should be visible on page 1
    expect(screen.getAllByText('Scheduled task 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scheduled task 25').length).toBeGreaterThan(0);
  });

  it('resets to page 1 when filtering scheduled tasks', () => {
    const manyScheduledTasks: Task[] = Array.from({ length: 15 }, (_, index) => ({
      id: index + 200,
      title: `Feature ${index + 1}`,
      status: 'TODO',
      priority: 'HIGH',
      startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
      dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
      assigneeName: index === 14 ? 'SpecialAssignee' : 'StandardDev',
    }));

    render(<TimelineView tasks={manyScheduledTasks} />);

    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: /^Page 2$/i }));
    expect(screen.getAllByText('Feature 15').length).toBeGreaterThan(0);

    // Filter by search query that only matches Feature 1
    fireEvent.change(screen.getByPlaceholderText('Search tasks, assignees, milestones'), {
      target: { value: 'Feature 10' },
    });

    expect(screen.getAllByText('Feature 10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Feature 15')).not.toBeInTheDocument();
  });

  it('filters tasks using the visible assignee dropdown', async () => {
    const mixedTasks: Task[] = [
      {
        id: 301,
        title: 'Asha task',
        status: 'IN_PROGRESS',
        startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
        dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
        assigneeName: 'Asha',
      },
      {
        id: 302,
        title: 'Ben task',
        status: 'TODO',
        startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
        dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
        assignees: [{ name: 'Ben' }],
      },
      {
        id: 303,
        title: 'Unassigned task',
        status: 'TODO',
        startDate: format(addDays(today, -1), 'yyyy-MM-dd'),
        dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
      },
    ];

    render(<TimelineView tasks={mixedTasks} />);

    // Open Assignee filter dropdown
    const assigneeFilterBtn = screen.getByRole('button', { name: /all assignees/i });
    expect(assigneeFilterBtn).toBeInTheDocument();
    fireEvent.click(assigneeFilterBtn);

    // Filter by Asha
    const ashaOption = await screen.findByRole('button', { name: /^Asha$/i });
    fireEvent.click(ashaOption);

    expect(screen.getAllByText('Asha task').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ben task')).not.toBeInTheDocument();
    expect(screen.queryByText('Unassigned task')).not.toBeInTheDocument();

    // Also select Ben
    const benOption = screen.getByRole('button', { name: /^Ben$/i });
    fireEvent.click(benOption);

    expect(screen.getAllByText('Asha task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ben task').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unassigned task')).not.toBeInTheDocument();

    // Toggle Asha off and select Unassigned
    fireEvent.click(ashaOption);
    fireEvent.click(benOption);
    const unassignedOption = screen.getByRole('button', { name: 'Unassigned' });
    fireEvent.click(unassignedOption);

    expect(screen.queryByText('Asha task')).not.toBeInTheDocument();
    expect(screen.queryByText('Ben task')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unassigned task').length).toBeGreaterThan(0);
  });

  it('keeps the assignee dropdown inside the viewport near the right edge', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    render(<TimelineView tasks={tasks} />);

    const assigneeFilterBtn = screen.getByRole('button', { name: /all assignees/i });
    Object.defineProperty(assigneeFilterBtn, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 930,
        y: 120,
        top: 120,
        left: 930,
        right: 990,
        bottom: 160,
        width: 60,
        height: 40,
        toJSON: () => ({}),
      }),
    });

    fireEvent.click(assigneeFilterBtn);

    const dropdown = await screen.findByTestId('timeline-assignee-dropdown');

    expect(dropdown).toHaveClass('fixed');
    expect(parseFloat(dropdown.style.left)).toBeLessThanOrEqual(1000 - 240 - 8);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });
});
