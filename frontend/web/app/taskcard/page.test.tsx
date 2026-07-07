import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import TaskPage from './page';
import api from '@/lib/axios';

// Mock components
jest.mock('./TaskHeader', () => ({
  __esModule: true,
  default: ({ onClose, project, taskId }: { onClose: (wasModified: boolean) => void; project: unknown; taskId: unknown }) => (
    <div data-testid="task-header">
      <span>Header: {String(project)} / {String(taskId)}</span>
      <button data-testid="archive-btn" onClick={() => onClose(true)}>Archive (onClose true)</button>
      <button data-testid="close-btn" onClick={() => onClose(false)}>Close (onClose false)</button>
    </div>
  ),
}));

jest.mock('./TaskMainContent', () => ({
  __esModule: true,
  default: ({ title, onUpdateTitle }: { title: string; onUpdateTitle: (title: string) => void }) => (
    <div data-testid="task-main-content">
      <span>Main Content: {title}</span>
      <button data-testid="update-title-btn" onClick={() => onUpdateTitle('Updated Title')}>Update Title</button>
    </div>
  ),
}));

jest.mock('./TaskSidebar', () => ({
  __esModule: true,
  default: ({ status }: { status: string }) => <div data-testid="task-sidebar">Sidebar: {status}</div>,
}));

jest.mock('@/components/github/CreateIssueFromTaskModal', () => ({
  __esModule: true,
  default: () => <div data-testid="github-modal">GitHub Modal</div>,
}));

// Mock services & UI
jest.mock('@/services/github-service', () => ({
  getProjectGitHubRepo: jest.fn(() => ({ repoFullName: 'owner/repo' })),
}));

jest.mock('@/components/ui', () => ({
  toast: jest.fn(),
}));

// Mock API and Navigation
const apiGetMock = api.get as jest.Mock;
const apiPutMock = api.put as jest.Mock;

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

const searchParamsGetMock = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

let webSocketCallback: ((event: { type: string; taskId: number }) => void) | null = null;
jest.mock('@/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: jest.fn((projectId, cb) => {
    webSocketCallback = cb;
  }),
}));

describe('TaskPage cache and invalidation', () => {
  const mockTask = {
    id: 123,
    title: 'Original Task Title',
    description: 'Task description',
    projectId: 456,
    projectName: 'Project Alpha',
    status: 'TODO',
    priority: 'HIGH',
    storyPoint: 5,
    reporterName: 'Reporter',
    assigneeName: 'Assignee',
    sprintName: 'Sprint 1',
    labels: [],
    createdAt: '2026-05-30T00:00:00Z',
    updatedAt: '2026-05-30T00:00:00Z',
    dueDate: '2026-06-30T00:00:00Z',
    subtasks: [],
    dependencies: [],
  };

  const originalBack = window.history.back;
  let backMock: jest.Mock;

  beforeAll(() => {
    backMock = jest.fn();
    Object.defineProperty(window, 'history', {
      value: { back: backMock },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'history', {
      value: { back: originalBack },
      writable: true,
    });
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    searchParamsGetMock.mockReturnValue('123');
    webSocketCallback = null;
    // Default implementation returns a slightly delayed promise to let React render intermediate state
    apiGetMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: mockTask }), 10)));
  });

  const waitForApiFinish = async (expectedText = 'Original Task Title') => {
    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent(expectedText);
    });
  };

  it('Cache Hit: loads non-expired cache instantly and refreshes with API response', async () => {
    const cachedTask = {
      ...mockTask,
      title: 'Cached Task Title',
    };
    
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: cachedTask,
        timestamp: Date.now() - 60 * 1000, // 1 minute old
      })
    );

    const apiTask = {
      ...mockTask,
      title: 'Fresh API Title',
    };
    apiGetMock.mockImplementationOnce(() => Promise.resolve({ data: apiTask }));

    render(<TaskPage />);

    // Cached title should be visible immediately (no loading screen)
    expect(screen.getByTestId('task-main-content')).toHaveTextContent('Cached Task Title');

    // Stale-while-revalidate should update to fresh data
    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('Fresh API Title');
    });

    // LocalStorage should be updated with the fresh data
    const updatedCache = JSON.parse(localStorage.getItem('planora:task:123') || '{}');
    expect(updatedCache.data.title).toBe('Fresh API Title');
    expect(typeof updatedCache.timestamp).toBe('number');
  });

  it('Expired Cache: ignores expired cache and shows loading before displaying API response', async () => {
    const cachedTask = {
      ...mockTask,
      title: 'Expired Task Title',
    };

    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: cachedTask,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes old
      })
    );

    const apiTask = {
      ...mockTask,
      title: 'Fresh API Title',
    };
    apiGetMock.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ data: apiTask }), 20)));

    render(<TaskPage />);

    // Expired cache should be ignored, showing loading skeleton instead of cached content
    expect(screen.queryByTestId('task-main-content')).not.toBeInTheDocument();

    // Should load the fresh API data
    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('Fresh API Title');
    });

    // LocalStorage should have updated cache
    const updatedCache = JSON.parse(localStorage.getItem('planora:task:123') || '{}');
    expect(updatedCache.data.title).toBe('Fresh API Title');
  });

  it('Corrupt Cache (Invalid JSON): ignores invalid cache, shows loading, and fetches from API', async () => {
    localStorage.setItem('planora:task:123', '{invalid json}');
    apiGetMock.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ data: mockTask }), 20)));

    render(<TaskPage />);
    
    // Shows loading because cache is corrupt
    expect(screen.queryByTestId('task-main-content')).not.toBeInTheDocument();
    
    await waitForApiFinish();
    
    // Corrupt entry gets overwritten
    const cachedObj = JSON.parse(localStorage.getItem('planora:task:123') || '{}');
    expect(cachedObj.data.title).toBe('Original Task Title');
  });

  it('Corrupt Cache (Missing Fields): ignores cache lacking data or timestamp structure', async () => {
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        title: 'Missing outer structure',
        timestamp: Date.now(),
      })
    );
    apiGetMock.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ data: mockTask }), 20)));

    render(<TaskPage />);
    
    expect(screen.queryByTestId('task-main-content')).not.toBeInTheDocument();
    
    await waitForApiFinish();
  });

  it('Update Invalidation: clears cached item when local updates are made', async () => {
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: mockTask,
        timestamp: Date.now(),
      })
    );

    apiPutMock.mockResolvedValueOnce({ data: { success: true } });
    apiGetMock
      .mockImplementationOnce(() => Promise.resolve({ data: mockTask }))
      .mockImplementationOnce(() => Promise.resolve({ data: { ...mockTask, title: 'Updated API Title' } }));

    render(<TaskPage />);

    // Wait for initial stale-revalidate fetch to complete
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('task-main-content')).toHaveTextContent('Original Task Title');

    // Trigger local update
    const updateBtn = screen.getByTestId('update-title-btn');
    fireEvent.click(updateBtn);

    // Verify PUT request is sent
    expect(apiPutMock).toHaveBeenCalledWith('/api/tasks/123', { title: 'Updated Title' });

    // Verify cache is removed/refetched
    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('Updated API Title');
    });

    const cacheValue = JSON.parse(localStorage.getItem('planora:task:123') || '{}');
    expect(cacheValue.data.title).toBe('Updated API Title');
  });

  it('Event Invalidation: invalidates and refetches when planora:task-updated custom event is fired', async () => {
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: mockTask,
        timestamp: Date.now(),
      })
    );

    apiGetMock
      .mockImplementationOnce(() => Promise.resolve({ data: mockTask }))
      .mockImplementationOnce(() => Promise.resolve({ data: { ...mockTask, title: 'Refetched Title' } }));

    render(<TaskPage />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('task-main-content')).toHaveTextContent('Original Task Title');

    // Dispatch global event for task 123
    act(() => {
      fireEvent(
        window,
        new CustomEvent('planora:task-updated', {
          detail: { taskId: '123' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('Refetched Title');
    });
  });

  it('WebSocket Invalidation: invalidates and refetches when WebSocket task events are received for the task ID', async () => {
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: mockTask,
        timestamp: Date.now(),
      })
    );

    apiGetMock
      .mockImplementationOnce(() => Promise.resolve({ data: mockTask }))
      .mockImplementationOnce(() => Promise.resolve({ data: { ...mockTask, title: 'WS Updated Title' } }));

    render(<TaskPage />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('task-main-content')).toHaveTextContent('Original Task Title');

    expect(webSocketCallback).toBeDefined();

    // Trigger WebSocket event
    act(() => {
      if (webSocketCallback) {
        webSocketCallback({
          type: 'TASK_UPDATED',
          taskId: 123,
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('WS Updated Title');
    });
  });

  it('Archive/Close Invalidation: clears cached item if onClose was called with wasModified=true', async () => {
    localStorage.setItem(
      'planora:task:123',
      JSON.stringify({
        data: mockTask,
        timestamp: Date.now(),
      })
    );

    render(<TaskPage />);

    await waitFor(() => {
      expect(screen.getByTestId('task-main-content')).toHaveTextContent('Original Task Title');
    });

    // Test close without modifications (wasModified = false)
    const closeBtn = screen.getByTestId('close-btn');
    fireEvent.click(closeBtn);
    expect(backMock).toHaveBeenCalledTimes(1);
    // Cache should still exist
    expect(localStorage.getItem('planora:task:123')).not.toBeNull();

    // Test close with modifications (wasModified = true)
    const archiveBtn = screen.getByTestId('archive-btn');
    fireEvent.click(archiveBtn);
    expect(backMock).toHaveBeenCalledTimes(2);
    // Cache should be removed
    expect(localStorage.getItem('planora:task:123')).toBeNull();
  });
});
