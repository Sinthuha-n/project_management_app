import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateTaskModal from './CreateTaskModal';
import { fetchProject, fetchProjectLabels, fetchTeamMembers } from '../api';
import { formatLocalDate } from '@/lib/date-format';

jest.mock('../api', () => ({
  fetchProject: jest.fn(),
  fetchProjectLabels: jest.fn(),
  fetchTeamMembers: jest.fn(),
}));

jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({
    minDate,
    onChange,
  }: {
    minDate?: Date;
    onChange: (date: Date | null) => void;
  }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return (
      <div data-testid="date-picker" data-min-date={minDate ? formatLocalDate(minDate) : ''}>
        <button type="button" onClick={() => onChange(yesterday)}>Pick yesterday</button>
        <button type="button" onClick={() => onChange(today)}>Pick today</button>
        <button type="button" onClick={() => onChange(tomorrow)}>Pick tomorrow</button>
      </div>
    );
  },
}));

const mockedFetchProject = fetchProject as jest.MockedFunction<typeof fetchProject>;
const mockedFetchProjectLabels = fetchProjectLabels as jest.MockedFunction<typeof fetchProjectLabels>;
const mockedFetchTeamMembers = fetchTeamMembers as jest.MockedFunction<typeof fetchTeamMembers>;

describe('Kanban CreateTaskModal', () => {
  const dateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return formatLocalDate(date);
  };

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

  it('sets today as the due date picker minimum', () => {
    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={jest.fn()}
        columnStatus="TODO"
        projectId={12}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /set due date/i }));

    expect(screen.getByTestId('date-picker')).toHaveAttribute('data-min-date', dateOffset(0));
  });

  it('sets today as the start date picker minimum', () => {
    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={jest.fn()}
        columnStatus="TODO"
        projectId={12}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /set start date/i }));

    expect(screen.getByTestId('date-picker')).toHaveAttribute('data-min-date', dateOffset(0));
  });

  it('blocks submitting a past start date', async () => {
    const onCreateTask = jest.fn().mockResolvedValue(undefined);

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        columnStatus="TODO"
        projectId={12}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Past start task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set start date/i }));
    fireEvent.click(screen.getByRole('button', { name: /pick yesterday/i }));
    fireEvent.click(screen.getByRole('button', { name: /^create task$/i }));

    expect(await screen.findByText(/start date cannot be in the past/i)).toBeInTheDocument();
    expect(onCreateTask).not.toHaveBeenCalled();
  });

  it('blocks submitting a past due date', async () => {
    const onCreateTask = jest.fn().mockResolvedValue(undefined);

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        columnStatus="TODO"
        projectId={12}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Past due task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set due date/i }));
    fireEvent.click(screen.getByRole('button', { name: /pick yesterday/i }));
    fireEvent.click(screen.getByRole('button', { name: /^create task$/i }));

    expect(await screen.findByText(/due date cannot be in the past/i)).toBeInTheDocument();
    expect(onCreateTask).not.toHaveBeenCalled();
  });

  it('submits today or future due dates', async () => {
    const onCreateTask = jest.fn().mockResolvedValue(undefined);

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        columnStatus="TODO"
        projectId={12}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Future due task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /set due date/i }));
    fireEvent.click(screen.getByRole('button', { name: /pick tomorrow/i }));
    fireEvent.click(screen.getByRole('button', { name: /^create task$/i }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Future due task',
      dueDate: dateOffset(1),
    })));
  });
});
