import { fireEvent, render, screen } from '@testing-library/react';
import TimelinePage from './page';
import { createTask, fetchProject, fetchTasksByProject } from '../../kanban/api';
import { getMilestones } from '@/services/milestone-service';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useTaskMutations } from '@/hooks/useTaskMutations';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '42' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../kanban/api', () => ({
  createTask: jest.fn(),
  fetchProject: jest.fn(),
  fetchTasksByProject: jest.fn(),
}));

jest.mock('@/services/api-contract', () => ({
  tasksApi: {
    get: jest.fn(),
  },
}));

jest.mock('@/services/milestone-service', () => ({
  getMilestones: jest.fn(),
}));

jest.mock('@/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: jest.fn(),
}));

jest.mock('@/hooks/useProjectTasks', () => ({
  useProjectTasks: jest.fn(),
}));

jest.mock('@/hooks/useTaskMutations', () => ({
  useTaskMutations: jest.fn(),
}));

jest.mock('../../kanban/components/TimelineView', () => ({
  __esModule: true,
  default: ({
    tasks,
    onOpenTask,
  }: {
    tasks: Array<{ id: number; title: string; status: string }>;
    onOpenTask: (taskId: number) => void;
  }) => (
    <div>
      <div data-testid="timeline-tasks">{tasks.map((task) => task.title).join(',')}</div>
      <button type="button" onClick={() => onOpenTask(1)}>Open first task</button>
    </div>
  ),
}));

jest.mock('@/app/taskcard/TaskCardModal', () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: (wasModified: boolean) => void }) => (
    <div data-testid="task-modal">
      <button type="button" onClick={() => onClose(true)}>Close modified task</button>
    </div>
  ),
}));

jest.mock('@/components/shared/CreateTaskModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    onCreateTask,
    showStoryPoints,
    disablePastDueDates,
  }: {
    isOpen: boolean;
    onCreateTask: (data: { title: string; status: string; dueDate?: string; storyPoint?: number }) => Promise<void>;
    showStoryPoints?: boolean;
    disablePastDueDates?: boolean;
  }) => (
    isOpen ? (
      <div data-testid="create-task-modal">
        <div data-testid="show-story-points">{String(showStoryPoints)}</div>
        <div data-testid="disable-past-due-dates">{String(disablePastDueDates)}</div>
        <button type="button" onClick={() => void onCreateTask({ title: 'New task', status: 'TODO', dueDate: '2026-09-15', storyPoint: 5 })}>
          Submit new task
        </button>
      </div>
    ) : null
  ),
}));

const mockedFetchTasksByProject = fetchTasksByProject as jest.Mock;
const mockedCreateTask = createTask as jest.Mock;
const mockedFetchProject = fetchProject as jest.Mock;
const mockedGetMilestones = getMilestones as jest.Mock;
const mockedUseProjectTasks = useProjectTasks as jest.Mock;
const mockedUseTaskMutations = useTaskMutations as jest.Mock;
const mockedRevalidate = jest.fn();
const mockedTaskCreate = jest.fn();

const initialTasks = [
  { id: 1, title: 'Original task', status: 'TODO', projectId: 42 },
];

describe('TimelinePage incremental task updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchTasksByProject.mockResolvedValue(initialTasks);
    mockedFetchProject.mockResolvedValue({ id: 42, type: 'KANBAN' });
    mockedGetMilestones.mockResolvedValue([]);
    mockedUseProjectTasks.mockReturnValue({
      tasks: initialTasks,
      loading: false,
      error: null,
      revalidate: mockedRevalidate,
    });
    mockedTaskCreate.mockImplementation((payload, request) => ({
      optimisticTask: { id: -1, ...payload },
      completion: request(payload),
    }));
    mockedUseTaskMutations.mockReturnValue({
      create: mockedTaskCreate,
    });
  });

  it('renders the canonical project task collection used by backlog and board', async () => {
    render(<TimelinePage />);

    expect(await screen.findByText('Original task')).toBeInTheDocument();
    expect(mockedUseProjectTasks).toHaveBeenCalledWith('42', false);
    expect(mockedFetchTasksByProject).not.toHaveBeenCalled();
  });

  it('does not refetch the full task list when a modified task modal closes', async () => {
    render(<TimelinePage />);

    await screen.findByText('Open first task');

    fireEvent.click(screen.getByText('Open first task'));
    fireEvent.click(screen.getByText('Close modified task'));

    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
    expect(mockedFetchTasksByProject).not.toHaveBeenCalled();
  });

  it('creates Kanban timeline tasks without story points', async () => {
    mockedCreateTask.mockResolvedValue({ id: 2, title: 'New task', status: 'TODO', projectId: 42 });

    render(<TimelinePage />);

    await screen.findByText('Open first task');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByTestId('show-story-points')).toHaveTextContent('false');
    expect(screen.getByTestId('disable-past-due-dates')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('Submit new task'));

    const payload = mockedTaskCreate.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      projectId: 42,
      title: 'New task',
      status: 'TODO',
      dueDate: '2026-09-15',
    }));
    expect(payload).not.toHaveProperty('storyPoint');
    expect(payload).not.toHaveProperty('startDate');
    expect(mockedTaskCreate).toHaveBeenCalledWith(payload, expect.any(Function));
    expect(mockedCreateTask).toHaveBeenCalledTimes(1);
    expect(mockedFetchTasksByProject).not.toHaveBeenCalled();
  });

  it('creates Agile timeline tasks with story points', async () => {
    mockedFetchProject.mockResolvedValue({ id: 42, type: 'AGILE' });
    mockedCreateTask.mockResolvedValue({ id: 2, title: 'New task', status: 'TODO', projectId: 42 });

    render(<TimelinePage />);

    await screen.findByText('Open first task');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByTestId('show-story-points')).toHaveTextContent('true');
    expect(screen.getByTestId('disable-past-due-dates')).toHaveTextContent('false');
    fireEvent.click(screen.getByText('Submit new task'));

    expect(mockedTaskCreate.mock.calls[0][0]).toEqual(expect.objectContaining({
      projectId: 42,
      title: 'New task',
      storyPoint: 5,
    }));
  });

  it('does not enable Kanban date validation before project type is known', async () => {
    mockedFetchProject.mockReturnValue(new Promise(() => undefined));

    render(<TimelinePage />);

    await screen.findByText('Open first task');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByTestId('show-story-points')).toHaveTextContent('false');
    expect(screen.getByTestId('disable-past-due-dates')).toHaveTextContent('false');
  });
});
