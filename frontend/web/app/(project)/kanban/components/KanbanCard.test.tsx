import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KanbanCard from './KanbanCard';

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
});
