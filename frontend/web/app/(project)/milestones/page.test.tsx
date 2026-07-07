import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MilestonesPage from './page';
import { useSearchParams } from 'next/navigation';
import { tasksApi } from '@/services/api-contract';
import {
  assignTaskToMilestone,
  createMilestone,
  deleteMilestone,
  getMilestones,
  updateMilestone,
} from '@/services/milestone-service';
import type { MilestoneResponse, Task } from '@/types';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('@/app/taskcard/TaskCardModal', () => ({
  __esModule: true,
  default: ({ taskId }: { taskId: number }) => <div data-testid="task-card-modal">Task {taskId}</div>,
}));

jest.mock('@/services/api-contract', () => ({
  tasksApi: {
    listAllByProject: jest.fn(),
  },
}));

jest.mock('@/services/milestone-service', () => ({
  getMilestones: jest.fn(),
  createMilestone: jest.fn(),
  updateMilestone: jest.fn(),
  deleteMilestone: jest.fn(),
  assignTaskToMilestone: jest.fn(),
}));

const mockedUseSearchParams = useSearchParams as jest.Mock;
const mockedTasksApi = tasksApi as jest.Mocked<typeof tasksApi>;
const mockedGetMilestones = getMilestones as jest.Mock;
const mockedCreateMilestone = createMilestone as jest.Mock;
const mockedUpdateMilestone = updateMilestone as jest.Mock;
const mockedDeleteMilestone = deleteMilestone as jest.Mock;
const mockedAssignTaskToMilestone = assignTaskToMilestone as jest.Mock;

const milestone = (overrides: Partial<MilestoneResponse>): MilestoneResponse => ({
  id: 1,
  projectId: 12,
  name: 'Launch',
  description: 'Public release',
  dueDate: '2026-07-10',
  status: 'OPEN',
  taskCount: 2,
  completedTaskCount: 1,
  progressPercent: 50,
  createdAt: '2026-07-01T00:00:00',
  updatedAt: '2026-07-01T00:00:00',
  ...overrides,
});

const task = (overrides: Partial<Task>): Task => ({
  id: 100,
  title: 'Finalize launch notes',
  status: 'DONE',
  projectId: 12,
  milestoneId: 1,
  milestoneName: 'Launch',
  priority: 'HIGH',
  assigneeName: 'Sam',
  dueDate: '2026-07-09',
  ...overrides,
});

function mockProjectRoute() {
  mockedUseSearchParams.mockReturnValue({
    get: (key: string) => (key === 'projectId' ? '12' : null),
  });
}

describe('MilestonesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockProjectRoute();
    mockedGetMilestones.mockResolvedValue([
      milestone({ id: 1, name: 'Launch', status: 'OPEN', dueDate: '2026-07-10' }),
      milestone({ id: 2, name: 'Archive', status: 'COMPLETED', dueDate: '2026-07-01', taskCount: 1, completedTaskCount: 1 }),
    ]);
    mockedTasksApi.listAllByProject.mockResolvedValue([
      task({ id: 100, milestoneId: 1, status: 'DONE' }),
      task({ id: 101, title: 'QA checklist', milestoneId: 1, status: 'TODO' }),
      task({ id: 102, title: 'Archive docs', milestoneId: 2, status: 'DONE' }),
    ]);
  });

  it('renders KPI data from milestones and tasks', async () => {
    render(<MilestonesPage />);

    await waitFor(() => {
      expect(screen.getByText((_, element) => (
        element?.textContent === '2 visible of 2 milestones · 2/3 linked tasks complete'
      ))).toBeInTheDocument();
    });

    expect(screen.getByText('Linked tasks')).toBeInTheDocument();
    expect(mockedTasksApi.listAllByProject).toHaveBeenCalledWith(12, { archived: false });
  });

  it('filters by search and due bucket', async () => {
    render(<MilestonesPage />);
    await screen.findByRole('heading', { name: 'Milestones' });

    fireEvent.change(screen.getByPlaceholderText('Search milestones'), { target: { value: 'archive' } });
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.queryByText('Launch')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('All dates'), { target: { value: 'no-date' } });
    expect(screen.getByText('No milestones match these filters')).toBeInTheDocument();
  });

  it('creates a milestone from the modal', async () => {
    mockedCreateMilestone.mockResolvedValue(milestone({ id: 3, name: 'Beta', status: 'OPEN' }));
    render(<MilestonesPage />);
    await screen.findByRole('heading', { name: 'Milestones' });

    fireEvent.click(screen.getByRole('button', { name: 'New milestone' }));
    fireEvent.change(screen.getByPlaceholderText('Milestone name *'), { target: { value: 'Beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockedCreateMilestone).toHaveBeenCalledWith(12, expect.objectContaining({ name: 'Beta', status: 'OPEN' }));
    });
  });

  it('optimistically updates milestone status', async () => {
    mockedUpdateMilestone.mockResolvedValue(milestone({ id: 1, name: 'Launch', status: 'IN_PROGRESS' }));
    render(<MilestonesPage />);
    await screen.findByRole('heading', { name: 'Milestones' });

    fireEvent.change(screen.getByLabelText('Change status for Launch'), { target: { value: 'IN_PROGRESS' } });

    await waitFor(() => {
      expect(mockedUpdateMilestone).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Launch', status: 'IN_PROGRESS' }));
    });
  });

  it('opens details and removes a linked task from a milestone', async () => {
    mockedAssignTaskToMilestone.mockResolvedValue(undefined);
    render(<MilestonesPage />);
    await screen.findByRole('heading', { name: 'Milestones' });

    fireEvent.click(screen.getByRole('button', { name: /Launch Public release/i }));
    expect(screen.getByRole('heading', { name: 'Launch', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Finalize launch notes')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove Finalize launch notes from milestone'));

    await waitFor(() => {
      expect(mockedAssignTaskToMilestone).toHaveBeenCalledWith(100, null);
    });
  });

  it('deletes through a confirmation modal', async () => {
    mockedDeleteMilestone.mockResolvedValue(undefined);
    render(<MilestonesPage />);
    await screen.findByRole('heading', { name: 'Milestones' });

    fireEvent.click(screen.getByLabelText('Delete Launch'));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedDeleteMilestone).toHaveBeenCalledWith(1);
    });
  });
});
