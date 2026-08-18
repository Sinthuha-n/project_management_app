import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateTaskModal from './CreateTaskModal';

jest.mock('@/hooks/useProjectStatuses', () => ({
  useProjectStatuses: () => ({
    statuses: [{ name: 'To Do', status: 'TODO', color: 'bg-gray-100 text-gray-700' }],
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
});
