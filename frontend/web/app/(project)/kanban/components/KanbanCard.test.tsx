import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KanbanCard from './KanbanCard';
import { formatLocalDate } from '@/lib/date-format';

jest.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

const task = {
  id: 5,
  title: 'Task with a deliberately long title that should never overlap the card controls',
  status: 'TODO',
  priority: 'MEDIUM',
  assigneeId: 101,
  assigneeName: 'Ada Lovelace',
};

const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};

describe('KanbanCard assignee editing', () => {
  it('exposes an assignee edit control and changes assignee', async () => {
    const onAssigneeChange = jest.fn().mockResolvedValue(undefined);

    render(
      <KanbanCard
        task={task}
        onAssigneeChange={onAssigneeChange}
        teamMembers={[
          { id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' },
          { id: 102, memberId: 12, userId: 102, name: 'Grace Hopper' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit assignee/i }));
    fireEvent.click(await screen.findByRole('button', { name: /grace hopper/i }));

    await waitFor(() => expect(onAssigneeChange).toHaveBeenCalledWith(5, 102));
  });

  it('allows clearing an existing assignee', async () => {
    const onAssigneeChange = jest.fn().mockResolvedValue(undefined);

    render(
      <KanbanCard
        task={task}
        onAssigneeChange={onAssigneeChange}
        teamMembers={[{ id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit assignee/i }));
    fireEvent.click(await screen.findByRole('button', { name: /unassigned/i }));

    await waitFor(() => expect(onAssigneeChange).toHaveBeenCalledWith(5, null));
  });

  it('renders multi-avatar cluster and calls onAssigneesChange when toggling assignees', async () => {
    const onAssigneesChange = jest.fn().mockResolvedValue(undefined);
    const multiTask = {
      ...task,
      assignees: [
        { id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' },
        { id: 102, memberId: 12, userId: 102, name: 'Grace Hopper' },
        { id: 103, memberId: 13, userId: 103, name: 'Alan Turing' },
        { id: 104, memberId: 14, userId: 104, name: 'Margaret Hamilton' },
      ],
    };

    render(
      <KanbanCard
        task={multiTask}
        onAssigneesChange={onAssigneesChange}
        teamMembers={[
          { id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' },
          { id: 102, memberId: 12, userId: 102, name: 'Grace Hopper' },
          { id: 103, memberId: 13, userId: 103, name: 'Alan Turing' },
          { id: 104, memberId: 14, userId: 104, name: 'Margaret Hamilton' },
          { id: 105, memberId: 15, userId: 105, name: 'Katherine Johnson' },
        ]}
      />
    );

    // Verify avatar stack badge +1 (4 members total, top 3 shown + 1 overflow)
    expect(screen.getByText('+1')).toBeInTheDocument();

    // Click assignees button to open popover
    fireEvent.click(screen.getByRole('button', { name: /edit assignees/i }));

    // Toggle a 5th member
    fireEvent.click(await screen.findByRole('button', { name: /katherine johnson/i }));

    await waitFor(() => {
      expect(onAssigneesChange).toHaveBeenCalledWith(
        5,
        expect.arrayContaining([101, 102, 103, 104, 105])
      );
    });
  });

  it('renders unassigned button and allows assigning multiple members', async () => {
    const onAssigneesChange = jest.fn().mockResolvedValue(undefined);
    const unassignedTask = {
      id: 9,
      title: 'Unassigned Task',
      status: 'TODO',
      priority: 'LOW',
    };

    render(
      <KanbanCard
        task={unassignedTask}
        onAssigneesChange={onAssigneesChange}
        teamMembers={[
          { id: 101, memberId: 11, userId: 101, name: 'Ada Lovelace' },
          { id: 102, memberId: 12, userId: 102, name: 'Grace Hopper' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /assign unassigned task/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ada lovelace/i }));

    await waitFor(() => {
      expect(onAssigneesChange).toHaveBeenCalledWith(9, [101]);
    });
  });
});

describe('KanbanCard due date editing', () => {
  it('sets the due date input minimum to today', () => {
    render(<KanbanCard task={task} onInlineUpdate={jest.fn()} />);

    fireEvent.click(screen.getByTitle('Set due date'));

    expect(screen.getByLabelText(/due date/i)).toHaveAttribute('min', dateOffset(0));
  });

  it('ignores manually-entered past due dates', () => {
    const onInlineUpdate = jest.fn().mockResolvedValue(undefined);
    render(<KanbanCard task={task} onInlineUpdate={onInlineUpdate} />);

    fireEvent.click(screen.getByTitle('Set due date'));
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dateOffset(-1) } });

    expect(onInlineUpdate).not.toHaveBeenCalled();
  });

  it('updates when today or a future due date is selected', async () => {
    const onInlineUpdate = jest.fn().mockResolvedValue(undefined);
    render(<KanbanCard task={task} onInlineUpdate={onInlineUpdate} />);

    fireEvent.click(screen.getByTitle('Set due date'));
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dateOffset(0) } });

    await waitFor(() => expect(onInlineUpdate).toHaveBeenCalledWith(5, { dueDate: dateOffset(0), title: task.title }));

    fireEvent.click(screen.getByTitle('Set due date'));
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dateOffset(3) } });

    await waitFor(() => expect(onInlineUpdate).toHaveBeenCalledWith(5, { dueDate: dateOffset(3), title: task.title }));
  });

  it('allows removing an existing due date', async () => {
    const onInlineUpdate = jest.fn().mockResolvedValue(undefined);
    render(<KanbanCard task={{ ...task, dueDate: dateOffset(3) }} onInlineUpdate={onInlineUpdate} />);

    fireEvent.click(screen.getByTitle('Set due date'));
    fireEvent.click(screen.getByRole('button', { name: /remove date/i }));

    await waitFor(() => expect(onInlineUpdate).toHaveBeenCalledWith(5, { dueDate: undefined, title: task.title }));
  });
});
