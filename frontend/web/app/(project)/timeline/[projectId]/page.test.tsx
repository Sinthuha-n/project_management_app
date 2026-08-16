import { fireEvent, render, screen } from '@testing-library/react';
import TimelinePage from './page';
import { createTask, fetchTasksByProject } from '../../kanban/api';
import { getMilestones } from '@/services/milestone-service';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useTaskMutations } from '@/hooks/useTaskMutations';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '42' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../kanban/api', () => ({
  createTask: jest.fn(),
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
  default: ({ isOpen, onCreateTask }: { isOpen: boolean; onCreateTask: (data: { title: string; status: string }) => Promise<void> }) => (
    isOpen ? (
      <div data-testid="create-task-modal">
        <button type="button" onClick={() => void onCreateTask({ title: 'New task', status: 'TODO' })}>
          Submit new task
        </button>
      </div>
    ) : null
  ),
}));

const mockedFetchTasksByProject = fetchTasksByProject as jest.Mock;
const mockedCreateTask = createTask as jest.Mock;
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

  it('creates through the shared task mutation coordinator', async () => {
    mockedCreateTask.mockResolvedValue({ id: 2, title: 'New task', status: 'TODO', projectId: 42 });

    render(<TimelinePage />);

    await screen.findByText('Open first task');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    fireEvent.click(screen.getByText('Submit new task'));

    expect(mockedTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 42, title: 'New task', status: 'TODO' }),
      expect.any(Function),
    );
    expect(mockedCreateTask).toHaveBeenCalledTimes(1);
    expect(mockedFetchTasksByProject).not.toHaveBeenCalled();
  });
});
