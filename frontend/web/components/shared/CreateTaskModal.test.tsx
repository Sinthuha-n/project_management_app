import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateTaskModal from './CreateTaskModal';
import { formatLocalDate } from '@/lib/date-format';

jest.mock('@/hooks/useProjectStatuses', () => ({
  useProjectStatuses: () => ({
    statuses: [],
    loading: false,
  }),
}));

jest.mock('@/hooks/projects/useProjectAssigneeOptions', () => ({
  useProjectAssigneeOptions: () => ({
    members: [],
    loadingMembers: false,
    membersError: null,
    retryMembers: jest.fn(),
  }),
}));

jest.mock('@/components/shared/LabelPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="label-picker" />,
}));

describe('CreateTaskModal story points', () => {
  const dateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
  };

  const fillTitleAndSubmit = async (title = 'New task') => {
    fireEvent.change(screen.getByPlaceholderText(/design new landing page/i), { target: { value: title } });
    fireEvent.click(screen.getByRole('button', { name: /^Create Task$/i }));
    await waitFor(() => expect(screen.queryByText('Failed to create task.')).not.toBeInTheDocument());
  };

  it('shows story points by default and submits a storyPoint value', async () => {
    const onCreateTask = jest.fn();

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        projectId={42}
      />,
    );

    expect(screen.getByText(/story points/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    await fillTitleAndSubmit();

    expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New task',
      status: 'TODO',
      priority: 'MEDIUM',
      storyPoint: 5,
    }));
  });

  it('hides story points and omits storyPoint when disabled', async () => {
    const onCreateTask = jest.fn();

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        projectId={42}
        showStoryPoints={false}
      />,
    );

    expect(screen.queryByText(/story points/i)).not.toBeInTheDocument();
    await fillTitleAndSubmit('Kanban task');

    expect(onCreateTask).toHaveBeenCalledWith(expect.not.objectContaining({
      storyPoint: expect.anything(),
    }));
    expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Kanban task',
      status: 'TODO',
      priority: 'MEDIUM',
    }));
  });

  it('sets today as the minimum due date when past due dates are disabled', () => {
    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={jest.fn()}
        projectId={42}
        disablePastDueDates
      />,
    );

    expect(screen.getByLabelText(/due date/i)).toHaveAttribute('min', dateOffset(0));
  });

  it('blocks past due dates when past due dates are disabled', () => {
    const onCreateTask = jest.fn();

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        projectId={42}
        disablePastDueDates
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/design new landing page/i), { target: { value: 'Past task' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dateOffset(-1) } });
    fireEvent.submit(screen.getByRole('button', { name: /^Create Task$/i }).closest('form') as HTMLFormElement);

    expect(screen.getByText(/due date cannot be in the past/i)).toBeInTheDocument();
    expect(onCreateTask).not.toHaveBeenCalled();
  });

  it('allows today and future due dates when past due dates are disabled', async () => {
    const onCreateTask = jest.fn();

    render(
      <CreateTaskModal
        isOpen
        onClose={jest.fn()}
        onCreateTask={onCreateTask}
        projectId={42}
        disablePastDueDates
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/design new landing page/i), { target: { value: 'Future task' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dateOffset(2) } });
    fireEvent.click(screen.getByRole('button', { name: /^Create Task$/i }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Future task',
      dueDate: dateOffset(2),
    })));
  });
});
