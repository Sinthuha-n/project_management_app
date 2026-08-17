import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateTaskModal from './CreateTaskModal';
import { fetchProject, fetchProjectLabels, fetchTeamMembers } from '../api';

jest.mock('../api', () => ({
  fetchProject: jest.fn(),
  fetchProjectLabels: jest.fn(),
  fetchTeamMembers: jest.fn(),
}));

jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: () => <div data-testid="date-picker" />,
}));

const mockedFetchProject = fetchProject as jest.MockedFunction<typeof fetchProject>;
const mockedFetchProjectLabels = fetchProjectLabels as jest.MockedFunction<typeof fetchProjectLabels>;
const mockedFetchTeamMembers = fetchTeamMembers as jest.MockedFunction<typeof fetchTeamMembers>;

describe('Kanban CreateTaskModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchProject.mockResolvedValue({ id: 12, teamId: 4 });
    mockedFetchProjectLabels.mockResolvedValue([]);
    mockedFetchTeamMembers.mockResolvedValue([
      { id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' },
      { id: 102, memberId: 12, userId: 102, name: 'Grace Hopper With A Very Long Display Name' },
    ]);
  });

  it('submits the selected assigneeId when creating a task', async () => {
    const onCreateTask = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <CreateTaskModal
        isOpen
        onClose={onClose}
        onCreateTask={onCreateTask}
        columnStatus="TODO"
        projectId={12}
      />
    );

    await waitFor(() => expect(mockedFetchTeamMembers).toHaveBeenCalledWith(4));

    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Wire assignee create flow' },
    });
    fireEvent.click(screen.getByRole('button', { name: /unassigned choose a project member/i }));
    fireEvent.click(screen.getByRole('option', { name: /ada lovelace/i }));
    fireEvent.click(screen.getByRole('button', { name: /^create task$/i }));

    await waitFor(() => {
      expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Wire assignee create flow',
        status: 'TODO',
        projectId: 12,
        assigneeId: 101,
      }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
