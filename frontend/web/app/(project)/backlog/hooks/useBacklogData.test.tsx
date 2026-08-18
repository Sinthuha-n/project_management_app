import { renderHook, waitFor } from '@testing-library/react';
import { useBacklogData } from './useBacklogData';

const mockFetchProjectLabels = jest.fn();
const mockFetchProject = jest.fn();
const mockFetchTeamMembers = jest.fn();
const mockFetchKanbanBoard = jest.fn();

jest.mock('../../kanban/api', () => ({
  fetchProjectLabels: (...args: unknown[]) => mockFetchProjectLabels(...args),
  fetchProject: (...args: unknown[]) => mockFetchProject(...args),
  fetchTeamMembers: (...args: unknown[]) => mockFetchTeamMembers(...args),
  fetchKanbanBoard: (...args: unknown[]) => mockFetchKanbanBoard(...args),
}));

jest.mock('@/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: jest.fn(),
}));

jest.mock('@/hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    move: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  }),
}));

jest.mock('@/hooks/useProjectTasks', () => ({
  useProjectTasks: () => ({
    tasks: [],
    loading: false,
    error: null,
    revalidate: jest.fn(),
  }),
}));

jest.mock('@/services/tasks-contract', () => ({
  normalizeTaskPriority: (priority: string) => priority,
  tasksApi: {},
}));

describe('useBacklogData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProjectLabels.mockResolvedValue([]);
    mockFetchProject.mockResolvedValue({});
    mockFetchTeamMembers.mockResolvedValue([]);
    mockFetchKanbanBoard.mockResolvedValue({
      columns: [
        { id: 1, status: 'TODO', title: 'To Do' },
        { id: 2, status: 'QA_READY', title: 'QA Ready' },
      ],
    });
  });

  it('derives backlog status options from Kanban board columns', async () => {
    const { result } = renderHook(() => useBacklogData('7'));

    await waitFor(() => expect(mockFetchKanbanBoard).toHaveBeenCalledWith(7));
    await waitFor(() => expect(result.current.statusOptions).toEqual([
      { status: 'TODO', title: 'To Do' },
      { status: 'QA_READY', title: 'QA Ready' },
    ]));
  });
});
