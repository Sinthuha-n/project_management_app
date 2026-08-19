import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BacklogPage from './page';
import { useSearchParams } from 'next/navigation';
import { ACCESS_DENIED_MESSAGE, ACCESS_DENIED_TITLE } from '@/lib/project-permissions';
import { useBacklogData } from './hooks/useBacklogData';
import { fetchProject } from '../kanban/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
  useSearchParams: jest.fn(),
}));

jest.mock('../kanban/api', () => ({
  fetchProject: jest.fn(),
}));

jest.mock('./hooks/useBacklogData', () => ({
  useBacklogData: jest.fn(),
}));

const mockedUseSearchParams = useSearchParams as jest.Mock;
const mockedFetchProject = fetchProject as jest.Mock;
const mockedUseBacklogData = useBacklogData as jest.Mock;

describe('Kanban BacklogPage Role-Based Access Control', () => {
  const mockHandleDelete = jest.fn();
  const mockHandleBulkDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSearchParams.mockReturnValue({
      get: (k: string) => (k === 'projectId' ? '123' : null),
    });
    mockedFetchProject.mockResolvedValue({ id: 123, type: 'KANBAN' });
  });

  const setupBacklogMock = (role: string | null) => {
    mockedUseBacklogData.mockReturnValue({
      tasks: [
        { id: 1, title: 'Task 1', status: 'TODO', priority: 'MEDIUM' },
        { id: 2, title: 'Task 2', status: 'IN_PROGRESS', priority: 'HIGH' },
      ],
      archivedTasks: [],
      archivedLoading: false,
      loading: false,
      error: null,
      collapsedGroups: {},
      toggleGroup: jest.fn(),
      selectedTask: null,
      setSelectedTask: jest.fn(),
      selectedTaskIdForModal: null,
      setSelectedTaskIdForModal: jest.fn(),
      showCreateModal: false,
      setShowCreateModal: jest.fn(),
      searchTerm: '',
      setSearchTerm: jest.fn(),
      filterPriority: [],
      setFilterPriority: jest.fn(),
      filterStatus: [],
      setFilterStatus: jest.fn(),
      filterAssignee: '',
      setFilterAssignee: jest.fn(),
      filterLabel: null,
      setFilterLabel: jest.fn(),
      filterDateRange: { startDate: null, endDate: null },
      setFilterDateRange: jest.fn(),
      groupBy: 'none',
      setGroupBy: jest.fn(),
      teamMembers: [],
      labels: [],
      statusOptions: [],
      selectedIds: new Set([1, 2]),
      setSelectedIds: jest.fn(),
      filteredTasks: [
        { id: 1, title: 'Task 1', status: 'TODO', priority: 'MEDIUM' },
        { id: 2, title: 'Task 2', status: 'IN_PROGRESS', priority: 'HIGH' },
      ],
      currentUserRole: role,
      handleMarkDone: jest.fn(),
      handleDelete: mockHandleDelete,
      handleAddTask: jest.fn(),
      handleStatusChange: jest.fn(),
      handleAssigneeChange: jest.fn(),
      handleAssignMultiple: jest.fn(),
      handleBulkDelete: mockHandleBulkDelete,
      handleBulkDone: jest.fn(),
      handleArchiveTask: jest.fn(),
      handleUnarchiveTask: jest.fn(),
      toggleSelect: jest.fn(),
      loadTasks: jest.fn(),
      handleDateChange: jest.fn(),
    });
  };

  it('shows Access Denied modal when Member clicks bulk Delete', async () => {
    setupBacklogMock('MEMBER');

    render(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const bulkDeleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(bulkDeleteBtn);

    expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
    expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
    expect(mockHandleBulkDelete).not.toHaveBeenCalled();
  });

  it('calls handleBulkDelete when Project Owner clicks bulk Delete', async () => {
    setupBacklogMock('OWNER');

    render(<BacklogPage />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    const bulkDeleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(bulkDeleteBtn);

    expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
    expect(mockHandleBulkDelete).toHaveBeenCalledTimes(1);
  });
});
