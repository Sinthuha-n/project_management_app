import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BacklogTaskRow from './BacklogTaskRow';
import type { Task } from '../../kanban/types';
import type { TeamMemberOption } from '../../kanban/api';
import { DEFAULT_BACKLOG_STATUS_OPTIONS } from '../status-options';
import { formatLocalDate } from '@/lib/date-format';
import { tasksApi } from '@/services/tasks-contract';

jest.mock('@/services/tasks-contract', () => ({
  tasksApi: {
    updateDates: jest.fn(),
  },
}));

jest.mock('react-day-picker', () => ({
  DayPicker: ({
    disabled,
    onSelect,
  }: {
    disabled?: { before?: Date };
    onSelect: (date: Date | undefined) => void;
  }) => {
    const toLocalDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return (
      <div data-testid="day-picker" data-disabled-before={disabled?.before ? toLocalDateKey(disabled.before) : ''}>
        <button type="button" onClick={() => onSelect(yesterday)}>Pick yesterday</button>
        <button type="button" onClick={() => onSelect(tomorrow)}>Pick tomorrow</button>
      </div>
    );
  },
}));

const mockedUpdateDates = tasksApi.updateDates as jest.Mock;

const mockTask: Task = {
  id: 101,
  title: 'Test Backlog Task',
  status: 'TODO',
  priority: 'HIGH',
  storyPoint: 3,
  dueDate: '2026-09-01',
  assigneeId: 1,
  assigneeName: 'Alice Johnson',
  assigneePhotoUrl: 'https://example.com/alice.jpg',
  assignees: [
    { id: 1, userId: 1, name: 'Alice Johnson', photoUrl: 'https://example.com/alice.jpg' },
    { id: 2, userId: 2, name: 'Bob Smith', photoUrl: 'https://example.com/bob.jpg' },
  ],
  labels: [{ id: 10, name: 'Frontend', color: '#6366F1' }],
};

const mockTeamMembers: TeamMemberOption[] = [
  { id: 1, userId: 1, memberId: 1, name: 'Alice Johnson', photoUrl: 'https://example.com/alice.jpg' },
  { id: 2, userId: 2, memberId: 2, name: 'Bob Smith', photoUrl: 'https://example.com/bob.jpg' },
  { id: 3, userId: 3, memberId: 3, name: 'Charlie Brown', photoUrl: null },
];

describe('BacklogTaskRow', () => {
  const dateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return formatLocalDate(date);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpdateDates.mockResolvedValue({});
  });

  it('renders task title and multiple assignee avatars', () => {
    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    expect(screen.getByText('Test Backlog Task')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    // Verify both assignees are in the title tooltip
    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    expect(assigneeBtn).toBeInTheDocument();
  });

  it('renders +N counter when more than 3 assignees are assigned', () => {
    const taskWithFourAssignees: Task = {
      ...mockTask,
      assignees: [
        { id: 1, userId: 1, name: 'Alice' },
        { id: 2, userId: 2, name: 'Bob' },
        { id: 3, userId: 3, name: 'Charlie' },
        { id: 4, userId: 4, name: 'David' },
      ],
    };

    render(
      <BacklogTaskRow
        task={taskWithFourAssignees}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('opens assignee dropdown and calls onAssignMultiple when a member is toggled', () => {
    const onAssignMultiple = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onAssignMultiple={onAssignMultiple}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    fireEvent.click(assigneeBtn);

    // Popover is open
    expect(screen.getByText('Assignees')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Toggle Charlie Brown (userId: 3)
    fireEvent.click(screen.getByText('Charlie Brown'));
    expect(onAssignMultiple).toHaveBeenCalledWith(101, [1, 2, 3]);
  });

  it('calls onAssignMultiple with empty array when Unassigned is clicked in single mode', () => {
    const onAssignMultiple = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onAssignMultiple={onAssignMultiple}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    const assigneeBtn = screen.getByTitle('Alice Johnson, Bob Smith');
    fireEvent.click(assigneeBtn);

    // Click Single mode
    fireEvent.click(screen.getByText('Single'));

    // Click Unassigned
    fireEvent.click(screen.getByText('Unassigned'));
    expect(onAssignMultiple).toHaveBeenCalledWith(101, []);
  });

  it('renders custom status options and changes to a custom status', () => {
    const onStatusChange = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={onStatusChange}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
        statusOptions={[
          ...DEFAULT_BACKLOG_STATUS_OPTIONS,
          { status: 'QA_READY', title: 'QA Ready' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /to do/i }));
    fireEvent.click(screen.getByRole('button', { name: /qa ready/i }));

    expect(onStatusChange).toHaveBeenCalledWith(101, 'QA_READY');
  });

  it('disables past due dates in the backlog date picker', () => {
    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /sep 1, 2026/i }));

    expect(screen.getByTestId('day-picker')).toHaveAttribute('data-disabled-before', dateOffset(0));
  });

  it('ignores past due dates selected in the backlog date picker', () => {
    const onDateChange = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onDateChange={onDateChange}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /sep 1, 2026/i }));
    fireEvent.click(screen.getByRole('button', { name: /pick yesterday/i }));

    expect(onDateChange).not.toHaveBeenCalled();
    expect(mockedUpdateDates).not.toHaveBeenCalled();
  });

  it('updates today or future due dates selected in the backlog date picker', () => {
    const onDateChange = jest.fn();

    render(
      <BacklogTaskRow
        task={mockTask}
        onDelete={jest.fn()}
        onClick={jest.fn()}
        onStatusChange={jest.fn()}
        onOpenModal={jest.fn()}
        onDateChange={onDateChange}
        teamMembers={mockTeamMembers}
        statusOptions={DEFAULT_BACKLOG_STATUS_OPTIONS}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /sep 1, 2026/i }));
    fireEvent.click(screen.getByRole('button', { name: /pick tomorrow/i }));

    expect(onDateChange).toHaveBeenCalledWith(101, dateOffset(1));
    expect(mockedUpdateDates).toHaveBeenCalledWith(101, { dueDate: dateOffset(1) });
  });
});
