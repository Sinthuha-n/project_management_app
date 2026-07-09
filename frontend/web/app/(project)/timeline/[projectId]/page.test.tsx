import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TimelinePage from './page';
import { createTask, fetchTasksByProject } from '../../kanban/api';
import { tasksApi } from '@/services/api-contract';
import { getMilestones } from '@/services/milestone-service';

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

jest.mock('@/lib/session-cache', () => ({
  buildSessionCacheKey: jest.fn(() => 'timeline-cache-key'),
  getSessionCache: jest.fn(() => ({ data: null, isStale: false })),
  setSessionCache: jest.fn(),
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
const mockedTasksApi = tasksApi as unknown as { get: jest.Mock };
const mockedGetMilestones = getMilestones as jest.Mock;

const initialTasks = [
  { id: 1, title: 'Original task', status: 'TODO', projectId: 42 },
];

describe('TimelinePage incremental task updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchTasksByProject.mockResolvedValue(initialTasks);
    mockedGetMilestones.mockResolvedValue([]);
  });

  it('does not refetch the full task list when a modified task modal closes', async () => {
    render(<TimelinePage />);

    await screen.findByText('Open first task');
    expect(mockedFetchTasksByProject).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Open first task'));
    fireEvent.click(screen.getByText('Close modified task'));

    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
    expect(mockedFetchTasksByProject).toHaveBeenCalledTimes(1);
  });

  it('merges task details from planora:task-updated without refetching all tasks', async () => {
    render(<TimelinePage />);

    await screen.findByText('Open first task');

    act(() => {
      window.dispatchEvent(new CustomEvent('planora:task-updated', {
        detail: {
          taskId: 1,
          task: { id: 1, title: 'Updated task', status: 'IN_PROGRESS', projectId: 42 },
        },
      }));
    });

    expect(await screen.findByText('Updated task')).toBeInTheDocument();
    expect(mockedFetchTasksByProject).toHaveBeenCalledTimes(1);
  });

  it('fetches only one task when a task update event has only a task id', async () => {
    mockedTasksApi.get.mockResolvedValue({ id: 1, title: 'Fetched one task', status: 'DONE', projectId: 42 });

    render(<TimelinePage />);

    await screen.findByText('Open first task');

    await act(async () => {
      window.dispatchEvent(new CustomEvent('planora:task-updated', {
        detail: { taskId: 1 },
      }));
    });

    await waitFor(() => expect(mockedTasksApi.get).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Fetched one task')).toBeInTheDocument();
    expect(mockedFetchTasksByProject).toHaveBeenCalledTimes(1);
  });

  it('appends a created task without refetching the full task list', async () => {
    mockedCreateTask.mockResolvedValue({ id: 2, title: 'New task', status: 'TODO', projectId: 42 });

    render(<TimelinePage />);

    await screen.findByText('Open first task');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    fireEvent.click(screen.getByText('Submit new task'));

    expect(await screen.findByText('Original task,New task')).toBeInTheDocument();
    expect(mockedCreateTask).toHaveBeenCalledTimes(1);
    expect(mockedFetchTasksByProject).toHaveBeenCalledTimes(1);
  });
});
