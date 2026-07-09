import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import CalendarPage from './page';
import { fetchCalendarEvents, patchTaskDates } from './api';
import { useSearchParams } from 'next/navigation';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { getSessionCache, setSessionCache } from '@/lib/session-cache';
import { tasksApi } from '@/services/api-contract';

let wsCallback: any = null;

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('./api', () => ({
  fetchCalendarEvents: jest.fn(),
  patchTaskDates: jest.fn(),
  mapTaskToCalendarEvent: jest.fn((task) => ({
    id: `task-${task.id}`,
    taskId: task.id,
    title: task.title || 'Untitled Task',
    kind: 'task',
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status || 'To Do',
  })),
}));

jest.mock('@/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: jest.fn((projectId, cb) => {
    wsCallback = cb;
  }),
}));

const mockGetSessionCache = jest.fn();
const mockSetSessionCache = jest.fn();
jest.mock('@/lib/session-cache', () => ({
  buildSessionCacheKey: jest.fn((page, scope) => `cache-${page}-${scope.join('-')}`),
  getSessionCache: (key: string, options: any) => mockGetSessionCache(key, options),
  setSessionCache: (key: string, data: any, ttl: number) => mockSetSessionCache(key, data, ttl),
}));

jest.mock('@/services/api-contract', () => ({
  tasksApi: {
    create: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('@/services/tasks-contract', () => ({
  get tasksApi() {
    return require('@/services/api-contract').tasksApi;
  },
  normalizeTaskPriority: (p: any) => p || 'MEDIUM',
}));

jest.mock('./components/MonthCalendarView', () => ({
  __esModule: true,
  default: ({ onEventDrop, events, onOpenTask }: any) => (
    <div data-testid="month-view">
      Month View
      <button data-testid="drop-btn" onClick={() => onEventDrop('task-101', new Date(2026, 3, 5))}>
        Drop Event
      </button>
      <button data-testid="open-task-btn" onClick={() => onOpenTask(101)}>
        Open Task
      </button>
      {events.map((e: any) => (
        <span key={e.id} data-testid={`event-${e.id}`}>
          {e.title} - {e.startDate}
        </span>
      ))}
    </div>
  ),
}));

jest.mock('@/components/shared/CreateTaskModal', () => ({
  __esModule: true,
  default: ({ onCreateTask, isOpen }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="create-modal">
        <button
          data-testid="create-btn"
          onClick={() =>
            onCreateTask({
              title: 'New Task Title',
              priority: 'NORMAL',
              storyPoint: 3,
              dueDate: '2026-04-05',
            })
          }
        >
          Create Task
        </button>
      </div>
    );
  },
}));

jest.mock('@/app/taskcard/TaskCardModal', () => ({
  __esModule: true,
  default: ({ onClose }: any) => (
    <div data-testid="task-card-modal">
      <button data-testid="close-modal-modified-btn" onClick={() => onClose(true)}>
        Close Modified
      </button>
      <button data-testid="close-modal-unmodified-btn" onClick={() => onClose(false)}>
        Close Unmodified
      </button>
    </div>
  ),
}));

const mockedFetchCalendarEvents = fetchCalendarEvents as jest.Mock;
const mockedPatchTaskDates = patchTaskDates as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockGetSessionCache.mockReturnValue({ data: null, isStale: false });
  });

  it('renders cached events immediately and calls fetchCalendarEvents in the background', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockGetSessionCache.mockReturnValue({
      data: [
        {
          id: 'task-101',
          taskId: 101,
          title: 'Cached Meeting',
          kind: 'task',
          status: 'To Do',
          dueDate: '2026-04-03',
          startDate: '2026-04-03',
        },
      ],
      isStale: true,
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Network Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);

    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    expect(screen.getByText('Cached Meeting - 2026-04-03')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Network Meeting - 2026-04-03')).toBeInTheDocument();
    });
    expect(mockedFetchCalendarEvents).toHaveBeenCalledWith('123');
  });

  it('renders standard loader first when no cache exists', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Network Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);
    expect(screen.queryByTestId('month-view')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });
  });

  it('Create task appends one calendar event without refetching all events', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([]);

    render(<CalendarPage />);
    await waitFor(() => {
      expect(screen.getByText('No scheduled work yet')).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: 'Create task' });
    fireEvent.click(createBtn);

    expect(screen.getByTestId('create-modal')).toBeInTheDocument();

    // Setup mock for creation API
    (tasksApi.create as jest.Mock).mockResolvedValue({
      id: 102,
      title: 'New Task Title',
      startDate: '2026-04-05',
      dueDate: '2026-04-05',
      status: 'To Do',
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-btn'));
    });

    expect(screen.getByText('New Task Title - 2026-04-05')).toBeInTheDocument();
    // Verify list events was only called once (on initial mount)
    expect(mockedFetchCalendarEvents).toHaveBeenCalledTimes(1);
  });

  it('Drag/drop calls patchTaskDates, updates only the moved event, and does not call fetchCalendarEvents on success', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);
    mockedPatchTaskDates.mockResolvedValue({
      id: 101,
      title: 'Meeting',
      dueDate: '2026-04-05',
      startDate: '2026-04-05',
      status: 'To Do',
    });

    render(<CalendarPage />);
    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('drop-btn'));
    });

    expect(screen.getByText('Meeting - 2026-04-05')).toBeInTheDocument();
    expect(mockedPatchTaskDates).toHaveBeenCalledWith(101, '2026-04-05', '2026-04-05');
    expect(mockedFetchCalendarEvents).toHaveBeenCalledTimes(1);
  });

  it('Drag/drop failure reverts the moved event only', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);
    mockedPatchTaskDates.mockRejectedValue(new Error('Network failure'));

    render(<CalendarPage />);
    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('drop-btn'));
    });

    // Expect to be reverted to the original date
    expect(screen.getByText('Meeting - 2026-04-03')).toBeInTheDocument();
    expect(mockedFetchCalendarEvents).toHaveBeenCalledTimes(1);
  });

  it('WebSocket TASK_UPDATED updates one calendar event', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);
    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });

    act(() => {
      wsCallback({
        type: 'TASK_UPDATED',
        task: {
          id: 101,
          title: 'WebSocket Meeting Update',
          startDate: '2026-04-10',
          dueDate: '2026-04-10',
          status: 'In Progress',
        },
      });
    });

    expect(screen.getByText('WebSocket Meeting Update - 2026-04-10')).toBeInTheDocument();
  });

  it('WebSocket TASK_DELETED removes one calendar event', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);
    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('event-task-101')).toBeInTheDocument();

    act(() => {
      wsCallback({
        type: 'TASK_DELETED',
        taskId: 101,
      });
    });

    expect(screen.queryByTestId('event-task-101')).not.toBeInTheDocument();
  });

  it('offers a route back to the dashboard when no project is selected', () => {
    mockedUseSearchParams.mockReturnValue({
      get: () => null,
    });

    render(<CalendarPage />);

    expect(screen.getByText('Select a project to view its calendar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('uses the saved project when the URL has no project ID', async () => {
    localStorage.setItem('currentProjectId', '456');
    mockedUseSearchParams.mockReturnValue({
      get: () => null,
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 1,
        title: 'Saved project task',
        kind: 'task',
        dueDate: '2026-04-03',
        startDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });
    expect(mockedFetchCalendarEvents).toHaveBeenCalledWith('456');
  });
});
